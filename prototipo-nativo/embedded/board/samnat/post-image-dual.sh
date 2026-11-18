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
    linux /bzImage root=PARTUUID=53414d4e-02 rootwait rootfstype=ext4 rw console=tty1 quiet loglevel=3 logo.nologo vt.global_cursor_default=0
}

menuentry "Install SamNat Synth to internal SSD" {
    linux /bzImage root=PARTUUID=53414d4e-02 rootwait rootfstype=ext4 rw console=tty1 quiet loglevel=3 logo.nologo vt.global_cursor_default=0 samnat.install=1
}
EOF

ROOTPATH_TMP=$(mktemp -d)
GENIMAGE_CFG_TMP=$(mktemp "$BINARIES_DIR/genimage-samnat.XXXXXX.cfg")
trap 'rm -rf "$ROOTPATH_TMP"; rm -f "$GENIMAGE_CFG_TMP"' EXIT
SOUNDFONTS_DIR="$PROJECT_ROOT/soundfonts"
DATA_SOUNDFONTS="$ROOTPATH_TMP/data/home/.samnat-synth/soundfonts"
mkdir -p "$DATA_SOUNDFONTS"

sf2_count=$(find "$SOUNDFONTS_DIR" -type f -iname '*.sf2' -print | wc -l | tr -d ' ')
if [ "$sf2_count" -eq 0 ]; then
	echo "No SF2 files found in $SOUNDFONTS_DIR" >&2
	exit 1
fi
sf2_bytes=$(find "$SOUNDFONTS_DIR" -type f -iname '*.sf2' -exec stat -c '%s' {} + | awk '{ total += $1 } END { printf "%.0f\n", total }')
sf2_mib=$(((sf2_bytes + 1048575) / 1048576))
# Keep at least 1 GiB available after the SF2 files, including ext4's
# default 5% reserved blocks, filesystem metadata, and user scene data.
data_size_mib=$(( ((sf2_mib + 1024) * 100 + 94) / 95 + 128 ))

find "$SOUNDFONTS_DIR" -type f -iname '*.sf2' -exec sh -c '
	root=$1
	destination=$2
	shift 2
	for sf2 do
		relative=${sf2#"$root"/}
		target="$destination/$relative"
		mkdir -p "$(dirname "$target")"
		cp -p "$sf2" "$target"
	done
' sh "$SOUNDFONTS_DIR" "$DATA_SOUNDFONTS" {} +
echo "Bundled $sf2_count SF2 files into the data partition (subdirectories preserved)."
if ! grep -Fq 'size = "120%"' "$GENIMAGE_CFG"; then
	echo "Could not find the dynamic data partition size in $GENIMAGE_CFG" >&2
	exit 1
fi
sed "s/size = \"120%\"/size = ${data_size_mib}M/" "$GENIMAGE_CFG" > "$GENIMAGE_CFG_TMP"
echo "Data partition target size: ${data_size_mib} MiB (SF2 payload: ${sf2_mib} MiB plus at least 1 GiB free)."

genimage \
	--rootpath "$ROOTPATH_TMP" \
	--tmppath "$BUILD_DIR/genimage.tmp" \
	--inputpath "$BINARIES_DIR" \
	--outputpath "$BINARIES_DIR" \
	--config "$GENIMAGE_CFG_TMP"
