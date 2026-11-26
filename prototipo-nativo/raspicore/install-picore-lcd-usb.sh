#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CACHE_DIR="$PROJECT_DIR/.cache/picore-lcd"
LOGIN_USER=${SUDO_USER:-${USER:-samuka}}
TCE_MOUNT=${1:-/media/$LOGIN_USER/piCore64_TCE}
BOOT_MOUNT=${2:-/media/$LOGIN_USER/piCore64_14}
KERNEL=6.1.68-piCore-v8
TCE="$TCE_MOUNT/tce"
OPTIONAL="$TCE/optional"

trap 'printf "Erro na linha %s. Confira a mensagem acima; os backups permanecem no pendrive.\n" "$LINENO" >&2' ERR
mountpoint -q "$TCE_MOUNT" || { echo "Partição TCE não montada: $TCE_MOUNT" >&2; exit 1; }
mountpoint -q "$BOOT_MOUNT" || { echo "Partição boot não montada: $BOOT_MOUNT" >&2; exit 1; }
[[ $(lsblk -dnro LABEL "$(findmnt -n -o SOURCE --target "$TCE_MOUNT")") == piCore64_TCE ]] || { echo 'Rótulo TCE incorreto.' >&2; exit 1; }
grep -Fq "modules-$KERNEL.gz" "$BOOT_MOUNT/config.txt" || { echo "Kernel diferente de $KERNEL; não alterei o pendrive." >&2; exit 1; }
[[ -d "$OPTIONAL" && -f "$TCE/onboot.lst" && -d "$BOOT_MOUNT/overlays" ]] || { echo 'Estrutura piCore incompleta.' >&2; exit 1; }
[[ -f "$OPTIONAL/alsa-modules-$KERNEL.tcz" ]] || { echo 'Falta o pacote de módulos ALSA, dependência dos módulos gráficos.' >&2; exit 1; }

for name in "graphics-$KERNEL.tcz" "touchscreen-$KERNEL.tcz"; do
  [[ -f "$CACHE_DIR/$name" && -f "$CACHE_DIR/$name.dep" && -f "$CACHE_DIR/$name.md5.txt" ]] || { echo "Pacote ausente no cache: $name" >&2; exit 1; }
  (cd "$CACHE_DIR" && md5sum -c "$name.md5.txt")
done
[[ -s "$CACHE_DIR/tft35a.dtbo" ]] || { echo 'Overlay tft35a ausente no cache.' >&2; exit 1; }

cp -n "$BOOT_MOUNT/config.txt" "$BOOT_MOUNT/config.before-samnat-lcd.txt"
cp -n "$TCE/onboot.lst" "$TCE/onboot.before-samnat-lcd.lst"
for name in "graphics-$KERNEL.tcz" "touchscreen-$KERNEL.tcz"; do
  for suffix in '' .dep .md5.txt; do
    install -m 0644 "$CACHE_DIR/$name$suffix" "$OPTIONAL/$name$suffix"
  done
done
install -m 0644 "$CACHE_DIR/tft35a.dtbo" "$BOOT_MOUNT/overlays/tft35a.dtbo"

# tft35a defines both ILI9486 and ADS7846; do not enable a second SPI overlay.
sed -i -E '/^[[:space:]]*dtoverlay=(piscreen|tft35a)(,|:|$)/s/^/# SamNat anterior: /' "$BOOT_MOUNT/config.txt"
printf '\n[all]\n# SamNat: LCD35-show MPI3501 e XPT2046\ndtparam=spi=on\ndtoverlay=tft35a,rotate=90\n' >> "$BOOT_MOUNT/config.txt"

TEMP_LIST=$(mktemp "$TCE/.samnat-onboot.XXXXXX")
awk -v graphics="graphics-$KERNEL.tcz" -v touch="touchscreen-$KERNEL.tcz" '
  $0 == graphics || $0 == touch { next }
  $0 == "SamNatSynth.tcz" { print graphics; print touch; found=1 }
  { print }
  END { if (!found) { print graphics; print touch } }
' "$TCE/onboot.lst" > "$TEMP_LIST"
chmod 0644 "$TEMP_LIST"
mv "$TEMP_LIST" "$TCE/onboot.lst"
sync
for name in "graphics-$KERNEL.tcz" "touchscreen-$KERNEL.tcz"; do
  (cd "$OPTIONAL" && md5sum -c "$name.md5.txt")
done
printf '\nLCD configurado. Ejete o pendrive antes de conectar a tela com o Pi desligado.\n'
printf 'O overlay SPI pode criar framebuffer mesmo sem o LCD conectado; o app pode passar a abrir nele.\n'
