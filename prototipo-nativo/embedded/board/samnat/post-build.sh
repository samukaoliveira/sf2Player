#!/bin/sh
set -eu

TARGET_DIR="$1"
: "${SAMNAT_APPDIR:?Set SAMNAT_APPDIR to the generated SamnatSynthNative.AppDir}"

# Do not hold appliance startup while waiting for an Ethernet interface or DHCP.
# Network setup continues in the background so the app can open immediately.
NETWORK_INTERFACES="$TARGET_DIR/etc/network/interfaces"
if [ -f "$NETWORK_INTERFACES" ]; then
	sed -i '/^[[:space:]]*wait-delay[[:space:]]/d' "$NETWORK_INTERFACES"
fi
NETWORK_INIT="$TARGET_DIR/etc/init.d/S40network"
if [ -f "$NETWORK_INIT" ]; then
	cat > "$NETWORK_INIT" <<'NETWORK_INIT_SCRIPT'
#!/bin/sh

case "$1" in
	start)
		mkdir -p /run/network /var/log
		(/sbin/ifup -a) >/var/log/network-init.log 2>&1 &
		echo "Starting network configuration in background."
		;;
	stop)
		/sbin/ifdown -a
		;;
	restart|reload)
		"$0" stop
		"$0" start
		;;
	*)
		echo "Usage: $0 {start|stop|restart}"
		exit 1
		;;
esac
NETWORK_INIT_SCRIPT
	chmod 0755 "$NETWORK_INIT"
fi

if [ ! -x "$SAMNAT_APPDIR/AppRun" ] || [ ! -x "$SAMNAT_APPDIR/qode" ]; then
	echo "The AppDir is incomplete: $SAMNAT_APPDIR" >&2
	exit 1
fi

mkdir -p "$TARGET_DIR/opt/samnat-synth"
cp -a "$SAMNAT_APPDIR/." "$TARGET_DIR/opt/samnat-synth/"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-session"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-start-x"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-audio-init"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-volume"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-brightness"
chmod 0755 "$TARGET_DIR/usr/local/sbin/samnat-install"
chmod 0755 "$TARGET_DIR/etc/init.d/S99samnat-data"
chmod 0755 "$TARGET_DIR/etc/init.d/S00samnat-splash"
chmod 0755 "$TARGET_DIR/etc/init.d/S20samnat-pointer"
rm -f "$TARGET_DIR/etc/init.d/S40xorg"
LINUXFB_PLUGIN="$TARGET_DIR/opt/samnat-synth/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_64/plugins/platforms/libqlinuxfb.so"
if [ ! -f "$LINUXFB_PLUGIN" ]; then
	echo "LinuxFB Qt plugin is missing from the packaged app: $LINUXFB_PLUGIN" >&2
	exit 1
fi
APP_AUDIO_LIB_DIR="$TARGET_DIR/opt/samnat-synth/lib/audio"
for runtime_library in libGLX.so.0 libGLdispatch.so.0 libOpenGL.so.0 libgthread-2.0.so.0; do
	if [ ! -f "$APP_AUDIO_LIB_DIR/$runtime_library" ]; then
		echo "Required LinuxFB runtime library is missing from the packaged app: $APP_AUDIO_LIB_DIR/$runtime_library" >&2
		exit 1
	fi
done
mkdir -p "$TARGET_DIR/data"

DEFAULT_SF2=${SAMNAT_DEFAULT_SF2:-${HOME:-}/.samnat-synth/soundfonts/k-pc88.sf2}
if [ -f "$DEFAULT_SF2" ]; then
	mkdir -p "$TARGET_DIR/usr/share/soundfonts"
	cp "$DEFAULT_SF2" "$TARGET_DIR/usr/share/soundfonts/default.sf2"
	chmod 0644 "$TARGET_DIR/usr/share/soundfonts/default.sf2"
else
	echo "No default SF2 found at $DEFAULT_SF2; the first app slot will start empty." >&2
fi

# The app ships its Qt LinuxFB plugin and audio runtime in the AppDir. The
# appliance boots directly to the framebuffer without starting Xorg.
