#!/bin/bash
set -euo pipefail

TARGET_DIR=${1:?Target directory required}
BOARD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$BOARD_DIR/../../../.." && pwd)
APPDIR=${SAMNAT_RPI_APPDIR:-$PROJECT_ROOT/raspberry/build/SamNatSynthARM64.AppDir}
SOUNDFONTS_DIR=${SAMNAT_SOUNDFONTS_DIR:-$PROJECT_ROOT/soundfonts}

if [[ ! -x "$APPDIR/AppRun" || ! -x "$APPDIR/qode" ]]; then
	echo "ARM64 AppDir missing at $APPDIR. Build it on Ubuntu with raspberry/build-appdir-rpi3.sh." >&2
	exit 1
fi
for native_file in \
	"$APPDIR/qode" \
	"$APPDIR/dist/nodegui_core.node" \
	"$APPDIR/dist/node_modules/midi/build/Release/midi.node" \
	"$APPDIR/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_arm64/plugins/platforms/libqlinuxfb.so"; do
	if [[ ! -f "$native_file" ]]; then
		echo "ARM64 runtime component missing: $native_file" >&2
		exit 1
	fi
	if ! readelf -h "$native_file" 2>/dev/null | grep -Eq 'Machine:.*AArch64'; then
		echo "Non-AArch64 file in Raspberry Pi AppDir: $native_file" >&2
		exit 1
	fi
done

mkdir -p "$TARGET_DIR/opt/samnat-synth" "$TARGET_DIR/data/home/.samnat-synth/soundfonts"
cp -a "$APPDIR/." "$TARGET_DIR/opt/samnat-synth/"

sf2_count=0
while IFS= read -r -d '' sf2; do
	relative=${sf2#"$SOUNDFONTS_DIR"/}
	destination="$TARGET_DIR/data/home/.samnat-synth/soundfonts/$relative"
	mkdir -p "$(dirname "$destination")"
	cp -p "$sf2" "$destination"
	((sf2_count += 1))
done < <(find "$SOUNDFONTS_DIR" -type f -iname '*.sf2' -print0)
if (( sf2_count == 0 )); then
	echo "No SF2 files found in $SOUNDFONTS_DIR" >&2
	exit 1
fi
echo "Bundled $sf2_count SF2 files in /data/home/.samnat-synth/soundfonts."

if [[ -f "$TARGET_DIR/data/home/.samnat-synth/soundfonts/Pianos/k-pc88.sf2" ]]; then
	mkdir -p "$TARGET_DIR/usr/share/soundfonts"
	ln -sfn /data/home/.samnat-synth/soundfonts/Pianos/k-pc88.sf2 "$TARGET_DIR/usr/share/soundfonts/default.sf2"
fi

install -m 0755 "$BOARD_DIR/samnat-session" "$TARGET_DIR/usr/local/bin/samnat-session"
install -m 0755 "$BOARD_DIR/samnat-audio-init" "$TARGET_DIR/usr/local/bin/samnat-audio-init"
for script in \
	usr/local/bin/samnat-volume \
	usr/local/bin/samnat-brightness \
	usr/local/sbin/samnat-install \
	etc/init.d/S00samnat-splash \
	etc/init.d/S20samnat-pointer; do
	[[ ! -f "$TARGET_DIR/$script" ]] || chmod 0755 "$TARGET_DIR/$script"
done

# The Pi uses the root filesystem as its writable settings store. Laptop-only
# Xorg, AMD reprobe, and secondary data-partition hooks do not apply here.
rm -f "$TARGET_DIR/etc/init.d/S98samnat-amdgpu-reprobe" \
	"$TARGET_DIR/etc/init.d/S99samnat-data" \
	"$TARGET_DIR/etc/init.d/S40xorg"
rm -rf "$TARGET_DIR/etc/X11"
mkdir -p "$TARGET_DIR/data/home"
