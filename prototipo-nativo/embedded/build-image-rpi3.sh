#!/bin/sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$HERE/.." && pwd)
RASPBERRY_DIR="$PROJECT_ROOT/raspberry"
BUILDROOT_SOURCE=${BUILDROOT_SOURCE:-/tmp/samnat-rpi3-buildroot-source}
BUILDROOT_OUTPUT=${BUILDROOT_OUTPUT:-/tmp/samnat-rpi3-buildroot-output}
BR2_DL_DIR=${BR2_DL_DIR:-/tmp/samnat-buildroot-dl}
BUILDROOT_VERSION=${BUILDROOT_VERSION:-2026.08}
APPDIR=${SAMNAT_RPI_APPDIR:-$RASPBERRY_DIR/build/SamNatSynthARM64.AppDir}
SOUNDFONTS_DIR=${SAMNAT_SOUNDFONTS_DIR:-$PROJECT_ROOT/soundfonts}
OUTPUT_DIR="$RASPBERRY_DIR/release-raspberry"
JOBS=${JOBS:-4}

if [ ! -f "$APPDIR/AppRun" ] || [ ! -x "$APPDIR/qode" ]; then
	echo "ARM64 AppDir not found; building it on this Ubuntu host in an emulated ARM64 container..."
	SAMNAT_APPDIR="$APPDIR" "$RASPBERRY_DIR/build-appdir-rpi3.sh"
fi
for native_file in \
	"$APPDIR/qode" \
	"$APPDIR/dist/nodegui_core.node" \
	"$APPDIR/dist/node_modules/midi/build/Release/midi.node" \
	"$APPDIR/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_arm64/plugins/platforms/libqlinuxfb.so"; do
	if [ ! -f "$native_file" ] || ! readelf -h "$native_file" 2>/dev/null | grep -Eq 'Machine:.*AArch64'; then
		echo "Missing or non-AArch64 runtime component: $native_file" >&2
		exit 1
	fi
done
if [ ! -d "$SOUNDFONTS_DIR" ] || ! find "$SOUNDFONTS_DIR" -type f -iname '*.sf2' -print -quit | grep -q .; then
	echo "No SF2 files found in $SOUNDFONTS_DIR" >&2
	exit 1
fi

if [ ! -f "$BUILDROOT_SOURCE/Makefile" ]; then
	ARCHIVE="/tmp/buildroot-$BUILDROOT_VERSION.tar.xz"
	mkdir -p "$BUILDROOT_SOURCE"
	if [ ! -f "$ARCHIVE" ]; then
		echo "Downloading Buildroot $BUILDROOT_VERSION source (archive is retained at $ARCHIVE)..."
		curl -fL --retry 3 "https://buildroot.org/downloads/buildroot-$BUILDROOT_VERSION.tar.xz" -o "$ARCHIVE.part"
		mv "$ARCHIVE.part" "$ARCHIVE"
	fi
	# Extraction into the persistent target-specific tree is repeatable if an
	# earlier extraction was interrupted; it never removes source or build data.
	tar -xf "$ARCHIVE" -C "$BUILDROOT_SOURCE" --strip-components=1
fi

mkdir -p "$BR2_DL_DIR" "$BUILDROOT_OUTPUT" "$OUTPUT_DIR"
make -C "$BUILDROOT_SOURCE" \
	BR2_EXTERNAL="$HERE" O="$BUILDROOT_OUTPUT" \
	BR2_DL_DIR="$BR2_DL_DIR" samnat_rpi3_64_defconfig
SAMNAT_RPI_APPDIR="$APPDIR" SAMNAT_SOUNDFONTS_DIR="$SOUNDFONTS_DIR" \
	BUILDROOT_SOURCE="$BUILDROOT_SOURCE" \
	make -C "$BUILDROOT_SOURCE" \
	BR2_EXTERNAL="$HERE" O="$BUILDROOT_OUTPUT" \
	BR2_DL_DIR="$BR2_DL_DIR" -j"$JOBS"

IMAGE="$BUILDROOT_OUTPUT/images/sdcard.img"
test -f "$IMAGE"
gzip -1 -c "$IMAGE" > "$OUTPUT_DIR/SamNatSynthPi3BPlus-arm64.img.gz"
sha256sum "$OUTPUT_DIR/SamNatSynthPi3BPlus-arm64.img.gz" > "$OUTPUT_DIR/SamNatSynthPi3BPlus-arm64.img.gz.sha256"
printf 'Embedded Raspberry Pi 3B+ image ready: %s\n' "$OUTPUT_DIR/SamNatSynthPi3BPlus-arm64.img.gz"
