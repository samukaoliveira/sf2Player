#!/bin/sh
set -eu

BINARIES_DIR="$1"
GENIMAGE_CFG="$2"
ROOT_PARTUUID=3b816b4b-8a8e-41ab-9d0d-000000000001

test -f "$BINARIES_DIR/bzImage"
test -f "$BINARIES_DIR/rootfs.ext4"
test -f "$BINARIES_DIR/efi-part/EFI/BOOT/bootx64.efi"
mkdir -p "$BINARIES_DIR/efi-part"
cp "$BINARIES_DIR/bzImage" "$BINARIES_DIR/efi-part/bzImage"
cat > "$BINARIES_DIR/efi-part/EFI/BOOT/grub.cfg" <<EOF
set default=0
set timeout=0

menuentry "SamNat Synth" {
    linux /bzImage root=PARTUUID=$ROOT_PARTUUID rootwait rootfstype=ext4 rw console=tty1 loglevel=3
}
EOF

ROOTPATH_TMP=$(mktemp -d)
trap 'rm -rf "$ROOTPATH_TMP"' EXIT
genimage \
	--rootpath "$ROOTPATH_TMP" \
	--tmppath "$BUILD_DIR/genimage.tmp" \
	--inputpath "$BINARIES_DIR" \
	--outputpath "$BINARIES_DIR" \
	--config "$GENIMAGE_CFG"
