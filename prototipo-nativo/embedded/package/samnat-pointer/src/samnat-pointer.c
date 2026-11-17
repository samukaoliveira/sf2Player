#define _GNU_SOURCE
#include <errno.h>
#include <dirent.h>
#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <libinput.h>
#include <libudev.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <syslog.h>
#include <time.h>
#include <unistd.h>

#define POINTER_NAME "SamNat Unified Pointer"
#define POINTER_RUNTIME_DIR "/run/samnat-pointer"
#define POINTER_EVENT_FILE POINTER_RUNTIME_DIR "/mouse-event"

static volatile sig_atomic_t stopping;
static int uinput_fd = -1;
static double pending_x;
static double pending_y;
static double pending_wheel;
static double pending_hwheel;

static void handle_signal(int signal_number)
{
	(void)signal_number;
	stopping = 1;
}

static bool is_bridge_device(const char *path)
{
	const char *event_name = strrchr(path, '/');
	if (!event_name || strncmp(event_name + 1, "event", 5) != 0)
		return false;

	char name_path[256];
	snprintf(name_path, sizeof(name_path), "/sys/class/input/%s/device/name", event_name + 1);
	FILE *name_file = fopen(name_path, "r");
	if (!name_file)
		return false;

	char name[128] = {0};
	bool matches = fgets(name, sizeof(name), name_file) != NULL &&
		strncmp(name, POINTER_NAME, strlen(POINTER_NAME)) == 0;
	fclose(name_file);
	return matches;
}

static int open_restricted(const char *path, int flags, void *user_data)
{
	(void)user_data;
	if (is_bridge_device(path))
		return -EACCES;
	int fd = open(path, flags | O_CLOEXEC);
	return fd < 0 ? -errno : fd;
}

static void close_restricted(int fd, void *user_data)
{
	(void)user_data;
	close(fd);
}

static const struct libinput_interface input_interface = {
	.open_restricted = open_restricted,
	.close_restricted = close_restricted,
};

static void emit_event(uint16_t type, uint16_t code, int32_t value)
{
	struct input_event event = {0};
	struct timespec now;
	clock_gettime(CLOCK_MONOTONIC, &now);
	event.time.tv_sec = now.tv_sec;
	event.time.tv_usec = now.tv_nsec / 1000;
	event.type = type;
	event.code = code;
	event.value = value;
	if (write(uinput_fd, &event, sizeof(event)) != (ssize_t)sizeof(event))
		syslog(LOG_WARNING, "uinput write failed: %s", strerror(errno));
}

static void sync_events(void)
{
	emit_event(EV_SYN, SYN_REPORT, 0);
}

static void emit_relative(double *pending, uint16_t code, double delta)
{
	*pending += delta;
	const int32_t whole = (int32_t)*pending;
	if (whole == 0)
		return;
	*pending -= whole;
	emit_event(EV_REL, code, whole);
}

static void emit_wheel(double *pending, uint16_t code, double amount)
{
	/* evdev uses one REL_WHEEL step for 120 libinput v120 units. */
	*pending += amount / 120.0;
	const int32_t whole = (int32_t)*pending;
	if (whole == 0)
		return;
	*pending -= whole;
	emit_event(EV_REL, code, whole);
}

static int create_virtual_pointer(void)
{
	uinput_fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
	if (uinput_fd < 0) {
		syslog(LOG_ERR, "cannot open /dev/uinput: %s", strerror(errno));
		return -1;
	}

	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_SYN) < 0 ||
	    ioctl(uinput_fd, UI_SET_EVBIT, EV_KEY) < 0 ||
	    ioctl(uinput_fd, UI_SET_EVBIT, EV_REL) < 0 ||
	    ioctl(uinput_fd, UI_SET_RELBIT, REL_X) < 0 ||
	    ioctl(uinput_fd, UI_SET_RELBIT, REL_Y) < 0 ||
	    ioctl(uinput_fd, UI_SET_RELBIT, REL_WHEEL) < 0 ||
	    ioctl(uinput_fd, UI_SET_RELBIT, REL_HWHEEL) < 0) {
		syslog(LOG_ERR, "cannot configure /dev/uinput: %s", strerror(errno));
		return -1;
	}

	const unsigned int buttons[] = {
		BTN_LEFT, BTN_RIGHT, BTN_MIDDLE, BTN_SIDE, BTN_EXTRA, BTN_FORWARD, BTN_BACK
	};
	for (size_t i = 0; i < sizeof(buttons) / sizeof(buttons[0]); i++) {
		if (ioctl(uinput_fd, UI_SET_KEYBIT, buttons[i]) < 0) {
			syslog(LOG_ERR, "cannot configure pointer button %u: %s", buttons[i], strerror(errno));
			return -1;
		}
	}

	struct uinput_setup setup = {0};
	setup.id.bustype = BUS_VIRTUAL;
	setup.id.vendor = 0x534e;
	setup.id.product = 0x0001;
	setup.id.version = 1;
	snprintf(setup.name, UINPUT_MAX_NAME_SIZE, "%s", POINTER_NAME);
	if (ioctl(uinput_fd, UI_DEV_SETUP, &setup) < 0 || ioctl(uinput_fd, UI_DEV_CREATE) < 0) {
		syslog(LOG_ERR, "cannot create virtual pointer: %s", strerror(errno));
		return -1;
	}
	return 0;
}

static int publish_pointer_event_path(void)
{
	for (int attempt = 0; attempt < 100; attempt++) {
		DIR *directory = opendir("/sys/class/input");
		if (directory) {
			struct dirent *entry;
			while ((entry = readdir(directory)) != NULL) {
				const char *event_name = entry->d_name;
				if (strncmp(event_name, "event", 5) != 0)
					continue;
				char name_path[256];
				snprintf(name_path, sizeof(name_path), "/sys/class/input/%s/device/name", event_name);
				FILE *name_file = fopen(name_path, "r");
				if (!name_file)
					continue;
				char name[128] = {0};
				const bool matches = fgets(name, sizeof(name), name_file) != NULL &&
					strncmp(name, POINTER_NAME, strlen(POINTER_NAME)) == 0;
				fclose(name_file);
				if (!matches)
					continue;

				char device_path[128];
				snprintf(device_path, sizeof(device_path), "/dev/input/%s", event_name);
				if (access(device_path, F_OK) != 0)
					continue;
				if (mkdir(POINTER_RUNTIME_DIR, 0755) != 0 && errno != EEXIST)
					return -1;
				FILE *path_file = fopen(POINTER_EVENT_FILE, "w");
				if (!path_file) {
					closedir(directory);
					return -1;
				}
				fprintf(path_file, "%s\n", device_path);
				fclose(path_file);
				closedir(directory);
				syslog(LOG_INFO, "virtual pointer ready at %s", device_path);
				return 0;
			}
			closedir(directory);
		}
		struct timespec pause = {.tv_sec = 0, .tv_nsec = 50000000};
		nanosleep(&pause, NULL);
	}
	syslog(LOG_ERR, "timed out waiting for the virtual pointer event node");
	return -1;
}

static void handle_pointer_event(struct libinput_event *event)
{
	enum libinput_event_type type = libinput_event_get_type(event);
	struct libinput_event_pointer *pointer = libinput_event_get_pointer_event(event);
	switch (type) {
	case LIBINPUT_EVENT_POINTER_MOTION:
		emit_relative(&pending_x, REL_X, libinput_event_pointer_get_dx(pointer));
		emit_relative(&pending_y, REL_Y, libinput_event_pointer_get_dy(pointer));
		sync_events();
		break;
	case LIBINPUT_EVENT_POINTER_BUTTON: {
		uint32_t code = libinput_event_pointer_get_button(pointer);
		if (code <= KEY_MAX)
			emit_event(EV_KEY, (uint16_t)code,
				libinput_event_pointer_get_button_state(pointer) == LIBINPUT_BUTTON_STATE_PRESSED);
		sync_events();
		break;
	}
	case LIBINPUT_EVENT_POINTER_SCROLL_WHEEL:
	case LIBINPUT_EVENT_POINTER_SCROLL_FINGER:
	case LIBINPUT_EVENT_POINTER_SCROLL_CONTINUOUS:
		if (libinput_event_pointer_has_axis(pointer, LIBINPUT_POINTER_AXIS_SCROLL_VERTICAL))
			emit_wheel(&pending_wheel, REL_WHEEL,
				libinput_event_pointer_get_scroll_value_v120(pointer, LIBINPUT_POINTER_AXIS_SCROLL_VERTICAL));
		if (libinput_event_pointer_has_axis(pointer, LIBINPUT_POINTER_AXIS_SCROLL_HORIZONTAL))
			emit_wheel(&pending_hwheel, REL_HWHEEL,
				libinput_event_pointer_get_scroll_value_v120(pointer, LIBINPUT_POINTER_AXIS_SCROLL_HORIZONTAL));
		sync_events();
		break;
	default:
		break;
	}
}

int main(void)
{
	openlog("samnat-pointer", LOG_PID, LOG_DAEMON);
	signal(SIGTERM, handle_signal);
	signal(SIGINT, handle_signal);

	struct udev *udev = udev_new();
	if (!udev) {
		syslog(LOG_ERR, "cannot create udev context");
		return 1;
	}
	struct libinput *input = libinput_udev_create_context(&input_interface, NULL, udev);
	if (!input) {
		syslog(LOG_ERR, "cannot initialize libinput");
		udev_unref(udev);
		return 1;
	}
	libinput_log_set_priority(input, LIBINPUT_LOG_PRIORITY_ERROR);

	if (create_virtual_pointer() != 0 || publish_pointer_event_path() != 0) {
		libinput_unref(input);
		udev_unref(udev);
		if (uinput_fd >= 0)
			close(uinput_fd);
		return 1;
	}
	if (libinput_udev_assign_seat(input, "seat0") != 0) {
		syslog(LOG_ERR, "cannot assign libinput seat0: %s", strerror(errno));
		ioctl(uinput_fd, UI_DEV_DESTROY);
		close(uinput_fd);
		libinput_unref(input);
		udev_unref(udev);
		return 1;
	}
	if (libinput_dispatch(input) != 0)
		syslog(LOG_WARNING, "initial libinput dispatch failed: %s", strerror(errno));

	syslog(LOG_INFO, "libinput pointer bridge started; USB mouse hotplug is active");
	struct pollfd descriptor = {.fd = libinput_get_fd(input), .events = POLLIN};
	while (!stopping) {
		int result = poll(&descriptor, 1, 250);
		if (result < 0) {
			if (errno == EINTR)
				continue;
			syslog(LOG_ERR, "poll failed: %s", strerror(errno));
			break;
		}
		if (result == 0)
			continue;
		if (libinput_dispatch(input) != 0) {
			syslog(LOG_WARNING, "libinput dispatch failed: %s", strerror(errno));
			continue;
		}
		struct libinput_event *event;
		while ((event = libinput_get_event(input)) != NULL) {
			enum libinput_event_type type = libinput_event_get_type(event);
			if (type == LIBINPUT_EVENT_POINTER_MOTION || type == LIBINPUT_EVENT_POINTER_BUTTON ||
			    type == LIBINPUT_EVENT_POINTER_SCROLL_WHEEL || type == LIBINPUT_EVENT_POINTER_SCROLL_FINGER ||
			    type == LIBINPUT_EVENT_POINTER_SCROLL_CONTINUOUS)
				handle_pointer_event(event);
			else if (type == LIBINPUT_EVENT_DEVICE_ADDED) {
				struct libinput_device *device = libinput_event_get_device(event);
				if (libinput_device_has_capability(device, LIBINPUT_DEVICE_CAP_POINTER))
					syslog(LOG_INFO, "pointer attached: %s", libinput_device_get_name(device));
			}
			libinput_event_destroy(event);
		}
	}

	syslog(LOG_INFO, "stopping libinput pointer bridge");
	unlink(POINTER_EVENT_FILE);
	libinput_unref(input);
	udev_unref(udev);
	ioctl(uinput_fd, UI_DEV_DESTROY);
	close(uinput_fd);
	closelog();
	return 0;
}
