#!/bin/bash
set -euo pipefail
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BOOT=${1:?Informe o ponto de montagem da partição de boot do piCore}
CACHE="$PROJECT_DIR/.cache/picore-early-lcd"
VERSION=6.1.68-piCore-v8
ARCHIVE="samnat-lcd-early-$VERSION.gz"
ROOTFS="$BOOT/rootfs-piCore64-14.1.gz"
HELPER="$PROJECT_DIR/.cache/picore-arm64-work/app-root/samnat-lcd-console"
mountpoint -q "$BOOT" || { echo "Boot não está montado em $BOOT" >&2; exit 1; }
for file in "$BOOT/config.txt" "$ROOTFS" "$HELPER"; do
    [ -f "$file" ] || { echo "Arquivo necessário ausente: $file" >&2; exit 1; }
done
grep -Eq '^dtoverlay=tft35a([, ]|$)' "$BOOT/config.txt" || { echo 'Overlay tft35a não configurado.' >&2; exit 1; }
work=$(mktemp -d "$CACHE/stage.XXXXXXXX")
mkdir -p "$work/root/opt/samnat-lcd-early" "$work/root/usr/local/bin"
(cd "$work/root"; gzip -dc "$ROOTFS" | cpio -id --quiet etc/init.d/rcS)
grep -q '^/bin/mount -a$' "$work/root/etc/init.d/rcS" || { echo 'rcS inesperado; boot não alterado.' >&2; exit 1; }
awk '{print; if ($0 == "/bin/mount -a") print "/etc/init.d/samnat-lcd-early"; if ($0 == "/etc/init.d/tc-config") print "/etc/init.d/samnat-lcd-save-log"}' "$work/root/etc/init.d/rcS" > "$work/rcS"
install -m 0755 "$work/rcS" "$work/root/etc/init.d/rcS"
install -m 0755 "$PROJECT_DIR/raspicore/samnat-lcd-early" "$work/root/etc/init.d/samnat-lcd-early"
install -m 0755 "$PROJECT_DIR/raspicore/samnat-lcd-save-log" "$work/root/etc/init.d/samnat-lcd-save-log"
install -m 0755 "$HELPER" "$work/root/usr/local/bin/samnat-lcd-console"
for module in backlight fb_sys_fops sysimgblt sysfillrect syscopyarea fbtft fb_ili9486 ads7846; do
    mapfile -t matches < <(find "$CACHE/modules" -type f -name "$module.ko")
    [ "${#matches[@]}" -eq 1 ] || { echo "Módulo $module não encontrado ou duplicado" >&2; exit 1; }
    install -m 0644 "${matches[0]}" "$work/root/opt/samnat-lcd-early/$module.ko"
done
(cd "$work/root"; find . -print0 | LC_ALL=C sort -z | cpio --null -o --format=newc --owner=0:0 --quiet | gzip -n > "$work/$ARCHIVE")
gzip -t "$work/$ARCHIVE"
awk -v archive="$ARCHIVE" '
    /^\[/ { section=tolower($0) }
    section == "[pi3]" && /^initramfs rootfs-piCore64-14\.1\.gz,modules-6\.1\.68-piCore-v8\.gz/ {
        if (index($0, archive) == 0) sub(/ followkernel/, "," archive " followkernel")
        found++
    }
    { print }
    END { if (found != 1) exit 1 }
' "$BOOT/config.txt" > "$work/config.txt" || { echo 'Configuração PI3 inesperada; boot não alterado.' >&2; exit 1; }
grep -q "$ARCHIVE followkernel" "$work/config.txt" || { echo 'Não foi possível incluir o initramfs.' >&2; exit 1; }
cp -n "$BOOT/config.txt" "$BOOT/config.before-samnat-early-lcd.txt"
cp "$work/$ARCHIVE" "$BOOT/$ARCHIVE.tmp"
mv "$BOOT/$ARCHIVE.tmp" "$BOOT/$ARCHIVE"
cp "$work/config.txt" "$BOOT/config.samnat-early.tmp"
mv "$BOOT/config.samnat-early.tmp" "$BOOT/config.txt"
sync
echo "LCD antecipado instalado em $BOOT. Backup: config.before-samnat-early-lcd.txt"
echo "Arquivos intermediários preservados em $work"
