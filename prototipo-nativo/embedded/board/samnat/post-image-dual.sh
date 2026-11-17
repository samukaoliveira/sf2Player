#!/bin/sh
set -eu

BINARIES_DIR="$1"
GENIMAGE_CFG="$2"
BOARD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$BOARD_DIR/../../.." && pwd)

test -f "$BINARIES_DIR/bzImage"
test -f "$BINARIES_DIR/rootfs.ext4"
test -f "$BINARIES_DIR/grub.img"
test -f "$BINARIES_DIR/boot.img"
test -f "$BINARIES_DIR/efi-part/EFI/BOOT/bootx64.efi"
mkdir -p "$BINARIES_DIR/efi-part"
cp "$BINARIES_DIR/bzImage" "$BINARIES_DIR/efi-part/bzImage"
cat > "$BINARIES_DIR/efi-part/EFI/BOOT/grub.cfg" <<'EOF'
set default=0
set timeout=5

menuentry "Start SamNat Synth (USB)" {
    linux /bzImage root=PARTUUID=53414d4e-02 rootwait rootfstype=ext4 rw console=tty1 loglevel=3
}

menuentry "Install SamNat Synth to internal SSD" {
    linux /bzImage root=PARTUUID=53414d4e-02 rootwait rootfstype=ext4 rw console=tty1 loglevel=3 samnat.install=1
}
EOF

ROOTPATH_TMP=$(mktemp -d)
trap 'rm -rf "$ROOTPATH_TMP"' EXIT
SOUNDFONTS_DIR="$PROJECT_ROOT/soundfonts"
DATA_SOUNDFONTS="$ROOTPATH_TMP/data/home/.samnat-synth/soundfonts"
mkdir -p "$DATA_SOUNDFONTS"
set -- "$SOUNDFONTS_DIR"/*.sf2
if [ ! -f "$1" ]; then
	echo "No SF2 files found in $SOUNDFONTS_DIR" >&2
	exit 1
fi
for sf2 in "$@"; do
	cp -p "$sf2" "$DATA_SOUNDFONTS/"
done
sf2_count=$(find "$DATA_SOUNDFONTS" -maxdepth 1 -type f -name '*.sf2' | wc -l | tr -d ' ')
echo "Bundled $sf2_count SF2 files into the data partition."

genimage \
	--rootpath "$ROOTPATH_TMP" \
	--tmppath "$BUILD_DIR/genimage.tmp" \
	--inputpath "$BINARIES_DIR" \
	--outputpath "$BINARIES_DIR" \
	--config "$GENIMAGE_CFG"
