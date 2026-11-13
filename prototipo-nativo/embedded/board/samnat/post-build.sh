#!/bin/sh
set -eu

TARGET_DIR="$1"
: "${SAMNAT_APPDIR:?Set SAMNAT_APPDIR to the generated SamnatSynthNative.AppDir}"

if [ ! -x "$SAMNAT_APPDIR/AppRun" ] || [ ! -x "$SAMNAT_APPDIR/qode" ]; then
	echo "The AppDir is incomplete: $SAMNAT_APPDIR" >&2
	exit 1
fi

mkdir -p "$TARGET_DIR/opt/samnat-synth"
cp -a "$SAMNAT_APPDIR/." "$TARGET_DIR/opt/samnat-synth/"
chmod 0755 "$TARGET_DIR/usr/local/bin/samnat-session"
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
