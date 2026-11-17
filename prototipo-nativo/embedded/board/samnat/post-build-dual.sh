#!/bin/sh
set -eu

TARGET_DIR="$1"
BOARD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$BOARD_DIR/post-build.sh" "$TARGET_DIR"

if [ -d "$TARGET_DIR/lib/grub/i386-pc" ]; then
	mkdir -p "$TARGET_DIR/boot/grub" "$BINARIES_DIR"
	cp "$BOARD_DIR/grub-bios.cfg" "$TARGET_DIR/boot/grub/grub.cfg"
	cp "$TARGET_DIR/lib/grub/i386-pc/boot.img" "$BINARIES_DIR/boot.img"
fi
