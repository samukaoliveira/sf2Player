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
chmod 0755 "$TARGET_DIR/usr/local/sbin/samnat-install"
chmod 0755 "$TARGET_DIR/etc/init.d/S99samnat-data"
mkdir -p "$TARGET_DIR/data"

DEFAULT_SF2=${SAMNAT_DEFAULT_SF2:-${HOME:-}/.samnat-synth/soundfonts/k-pc88.sf2}
if [ -f "$DEFAULT_SF2" ]; then
	mkdir -p "$TARGET_DIR/usr/share/soundfonts"
	cp "$DEFAULT_SF2" "$TARGET_DIR/usr/share/soundfonts/default.sf2"
	chmod 0644 "$TARGET_DIR/usr/share/soundfonts/default.sf2"
else
	echo "No default SF2 found at $DEFAULT_SF2; the first app slot will start empty." >&2
fi

# The app's Qt xcb plugin loads Mesa/OpenGL and X11 from this root filesystem.
# The app itself, its Qode runtime, ALSA clients, and FluidSynth stay in AppDir.
