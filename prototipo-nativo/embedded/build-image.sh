#!/bin/sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$HERE/.." && pwd)
BUILDROOT_SOURCE=${BUILDROOT_SOURCE:-/tmp/samnat-buildroot-source}
BUILDROOT_OUTPUT=${BUILDROOT_OUTPUT:-/tmp/samnat-buildroot-output}
APPDIR=${APPDIR:-$PROJECT_ROOT/deploy/linux/build/SamnatSynthNative.AppDir}
BUILDROOT_VERSION=${BUILDROOT_VERSION:-2026.08}
DEFAULT_SF2=${DEFAULT_SF2:-${HOME:-}/.samnat-synth/soundfonts/k-pc88.sf2}
JOBS=${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '2')}

if [ ! -f "$BUILDROOT_SOURCE/Makefile" ]; then
	ARCHIVE="/tmp/buildroot-$BUILDROOT_VERSION.tar.xz"
	EXTRACT_DIR=$(mktemp -d /tmp/samnat-buildroot.XXXXXX)
	trap 'rm -rf "$EXTRACT_DIR"' EXIT
	echo "Downloading official Buildroot $BUILDROOT_VERSION source..."
	curl -fL --retry 3 "https://buildroot.org/downloads/buildroot-$BUILDROOT_VERSION.tar.xz" -o "$ARCHIVE"
	tar -xf "$ARCHIVE" -C "$EXTRACT_DIR"
	mkdir -p "$(dirname "$BUILDROOT_SOURCE")"
	mv "$EXTRACT_DIR/buildroot-$BUILDROOT_VERSION" "$BUILDROOT_SOURCE"
	rmdir "$EXTRACT_DIR"
	trap - EXIT
fi
if [ ! -x "$APPDIR/AppRun" ]; then
	echo "AppDir not found at $APPDIR. Run 'npm run pack:linux' first or set APPDIR." >&2
	exit 1
fi

make -C "$BUILDROOT_SOURCE" BR2_EXTERNAL="$HERE" O="$BUILDROOT_OUTPUT" samnat_x86_64_defconfig
SAMNAT_APPDIR="$APPDIR" SAMNAT_DEFAULT_SF2="$DEFAULT_SF2" BUILDROOT_SOURCE="$BUILDROOT_SOURCE" make -C "$BUILDROOT_SOURCE" BR2_EXTERNAL="$HERE" O="$BUILDROOT_OUTPUT" -j"$JOBS"

IMAGE="$BUILDROOT_OUTPUT/images/samnat-synth-x86_64.img"
OUTPUT_DIR="$PROJECT_ROOT/release-linux"
mkdir -p "$OUTPUT_DIR"
gzip -1 -c "$IMAGE" > "$OUTPUT_DIR/SamNatSynthEmbedded-x86_64.img.gz"
sha256sum "$OUTPUT_DIR/SamNatSynthEmbedded-x86_64.img.gz" > "$OUTPUT_DIR/SamNatSynthEmbedded-x86_64.img.gz.sha256"
printf 'Embedded image ready: %s\n' "$OUTPUT_DIR/SamNatSynthEmbedded-x86_64.img.gz"
