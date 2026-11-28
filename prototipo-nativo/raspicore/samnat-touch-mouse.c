#include <errno.h>
#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

static int emit(int fd, unsigned short type, unsigned short code, int value) {
    struct input_event ev = {0};
    ev.type = type; ev.code = code; ev.value = value;
    return write(fd, &ev, sizeof(ev)) == sizeof(ev) ? 0 : -1;
}
static int normalize(int value, struct input_absinfo *axis) {
    if (axis->maximum <= axis->minimum) return -1;
    long long v = (long long)(value - axis->minimum) * 4095 / (axis->maximum - axis->minimum);
    return v < 0 ? 0 : v > 4095 ? 4095 : (int)v;
}
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    int in = open(argv[1], O_RDONLY), out = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (in < 0 || out < 0) { perror("touch bridge open"); return 1; }
    struct input_absinfo x, y;
    if (ioctl(in, EVIOCGABS(ABS_X), &x) || ioctl(in, EVIOCGABS(ABS_Y), &y) || x.maximum <= x.minimum || y.maximum <= y.minimum) {
        fprintf(stderr, "touch bridge: limites ABS_X/ABS_Y inválidos\n"); return 1;
    }
    if (ioctl(out, UI_SET_EVBIT, EV_KEY) || ioctl(out, UI_SET_KEYBIT, BTN_LEFT) ||
        ioctl(out, UI_SET_EVBIT, EV_ABS) || ioctl(out, UI_SET_ABSBIT, ABS_X) ||
        ioctl(out, UI_SET_ABSBIT, ABS_Y)) { perror("touch bridge uinput"); return 1; }
    ioctl(out, UI_SET_PROPBIT, INPUT_PROP_POINTER);
    struct uinput_user_dev dev = {0};
    snprintf(dev.name, sizeof(dev.name), "SamNat Touch Mouse");
    dev.id.bustype = BUS_VIRTUAL; dev.id.vendor = 0x534e; dev.id.product = 1;
    dev.absmax[ABS_X] = dev.absmax[ABS_Y] = 4095;
    if (write(out, &dev, sizeof(dev)) != sizeof(dev) || ioctl(out, UI_DEV_CREATE)) { perror("touch bridge create"); return 1; }
    fprintf(stderr, "SamNat: touch bridge pronto; ABS X=%d..%d Y=%d..%d\n", x.minimum, x.maximum, y.minimum, y.maximum);
    struct input_event ev;
    while (read(in, &ev, sizeof(ev)) == sizeof(ev)) {
        if (ev.type == EV_ABS && (ev.code == ABS_X || ev.code == ABS_Y)) {
            int pos = normalize(ev.value, ev.code == ABS_X ? &x : &y);
            if (pos >= 0) emit(out, EV_ABS, ev.code, pos);
        } else if (ev.type == EV_KEY && ev.code == BTN_TOUCH) emit(out, EV_KEY, BTN_LEFT, ev.value != 0);
        else if (ev.type == EV_SYN && ev.code == SYN_REPORT) emit(out, EV_SYN, SYN_REPORT, 0);
    }
    ioctl(out, UI_DEV_DESTROY); close(out); close(in);
    return 0;
}
