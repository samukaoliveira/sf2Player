#!/bin/bash
set -euo pipefail

BINARIES_DIR=${1:?Binary directory required}
: "${BUILD_DIR:?Buildroot BUILD_DIR was not exported}"
: "${HOST_DIR:?Buildroot HOST_DIR was not exported}"

BOARD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
FIRMWARE_DIR="$BINARIES_DIR/rpi-firmware"
TEMPLATE="$BOARD_DIR/genimage.cfg.in"
KERNEL=$(sed -n 's/^kernel=//p' "$FIRMWARE_DIR/config.txt" | tail -n 1)
if [[ -z "$KERNEL" || ! -f "$BINARIES_DIR/$KERNEL" ]]; then
	echo "Raspberry Pi kernel configured in $FIRMWARE_DIR/config.txt is missing: $KERNEL" >&2
	exit 1
fi

BOOT_FILES=
for file in "$BINARIES_DIR"/*.dtb "$FIRMWARE_DIR"/*; do
	[[ -e "$file" ]] || continue
	relative=${file#"$BINARIES_DIR"/}
	BOOT_FILES+=$'\t\t\t"'"$relative"'",\n'
done
BOOT_FILES+=$'\t\t\t"'"$KERNEL"'",\n'

GENIMAGE_CFG=$(mktemp "$BINARIES_DIR/genimage-samnat-rpi3.XXXXXX.cfg")
GENIMAGE_TMP=$(mktemp -d "$BUILD_DIR/genimage-samnat-rpi3.XXXXXX")
ROOTPATH_TMP=$(mktemp -d "$BUILD_DIR/genroot-samnat-rpi3.XXXXXX")
export BOOT_FILES TEMPLATE GENIMAGE_CFG
awk '
	/#BOOT_FILES#/ { printf "%s", ENVIRON["BOOT_FILES"]; next }
	{ print }
' "$TEMPLATE" > "$GENIMAGE_CFG"

"$HOST_DIR/bin/genimage" \
	--rootpath "$ROOTPATH_TMP" \
	--tmppath "$GENIMAGE_TMP" \
	--inputpath "$BINARIES_DIR" \
	--outputpath "$BINARIES_DIR" \
	--config "$GENIMAGE_CFG"

printf 'Raspberry Pi bootable image ready: %s\n' "$BINARIES_DIR/sdcard.img"
