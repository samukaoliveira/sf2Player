#!/usr/bin/env bash
set -euo pipefail

RASPICORE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$RASPICORE_DIR/.." && pwd)
TCE_MOUNT=${1:-}
BOOT_MOUNT=${2:-}
EXTENSION=${SAMNAT_PICORE_EXTENSION:-$RASPICORE_DIR/release-picore/SamNatSynth.tcz}
SOUNDFONTS_DIR=${SAMNAT_SOUNDFONTS_DIR:-$PROJECT_ROOT/soundfonts}
SF2_FILES=(
	'Pianos/k-pc88.sf2'
	'Pads/General_Montage_Pads_Warm.sf2'
	'Strings e Brass/General_Montage_Strings_Section.sf2'
	'Organs/General_Montage_Organs_Drawbar.sf2'
	'Synths/General_Montage_Leads.sf2'
)

if [[ -z "$TCE_MOUNT" || ! -d "$TCE_MOUNT/tce" ]]; then
	echo "Uso: sudo $0 /ponto/de/montagem/da/particao-ext4-tce [/ponto/de/montagem/da-particao-boot]" >&2
	echo "A partição TCE deve estar expandida e montada; o script não grava a imagem nem redimensiona partições." >&2
	exit 2
fi
if [[ ! -f "$EXTENSION" || ! -f "$EXTENSION.md5.txt" ]]; then
	echo "SamNatSynth.tcz ou seu checksum não encontrado. Gere-o primeiro com raspicore/package-picore-tcz.sh." >&2
	exit 1
fi
if [[ ! -f "$EXTENSION.dep" ]]; then
	echo "Arquivo de dependências piCore ausente: $EXTENSION.dep" >&2
	exit 1
fi
if [[ ! -d "$SOUNDFONTS_DIR" ]]; then
	echo "Pasta de SoundFonts não encontrada: $SOUNDFONTS_DIR" >&2
	exit 1
fi
if [[ -n "$BOOT_MOUNT" && ! -f "$BOOT_MOUNT/config.txt" ]]; then
	echo "Não encontrei config.txt em $BOOT_MOUNT." >&2
	exit 1
fi
TCE_DIR="$TCE_MOUNT/tce"
OPTIONAL_DIR="$TCE_DIR/optional"
DATA_ROOT="$TCE_DIR/samnat-synth-data"
SF2_BYTES=0
for relative_path in "${SF2_FILES[@]}"; do
	if [[ ! -f "$SOUNDFONTS_DIR/$relative_path" ]]; then
		echo "SoundFont necessário não encontrado: $SOUNDFONTS_DIR/$relative_path" >&2
		exit 1
	fi
	file_bytes=$(stat -c '%s' "$SOUNDFONTS_DIR/$relative_path")
	SF2_BYTES=$((SF2_BYTES + file_bytes))
done
EXT_BYTES=$(stat -c '%s' "$EXTENSION")
AVAILABLE_BYTES=$(df -PB1 "$TCE_MOUNT" | awk 'NR == 2 {print $4}')
REQUIRED_BYTES=$((SF2_BYTES + EXT_BYTES + 536870912))
if (( AVAILABLE_BYTES < REQUIRED_BYTES )); then
	printf 'Espaço livre insuficiente na partição TCE: livre=%s bytes, necessário aproximadamente=%s bytes.\n' "$AVAILABLE_BYTES" "$REQUIRED_BYTES" >&2
	echo "Expanda a partição ext4 do piCore antes de instalar; o script não altera o particionamento." >&2
	exit 1
fi

mkdir -p "$OPTIONAL_DIR" "$DATA_ROOT/soundfonts" "$DATA_ROOT/logs"
install -m 0644 "$EXTENSION" "$OPTIONAL_DIR/SamNatSynth.tcz"
install -m 0644 "$EXTENSION.md5.txt" "$OPTIONAL_DIR/SamNatSynth.tcz.md5.txt"
if ! grep -Fxq 'alsa.tcz' "$TCE_DIR/onboot.lst" 2>/dev/null; then
	printf '%s\n' 'alsa.tcz' >> "$TCE_DIR/onboot.lst"
fi
install -m 0644 "$EXTENSION.dep" "$OPTIONAL_DIR/SamNatSynth.tcz.dep"
if ! grep -Fxq 'SamNatSynth.tcz' "$TCE_DIR/onboot.lst" 2>/dev/null; then
	printf '%s\n' 'SamNatSynth.tcz' >> "$TCE_DIR/onboot.lst"
fi

# Keep only the five test banks on the persistent TCE partition, preserving
# the relative folders used by the app's default scene. Never overwrite files.
for relative_path in "${SF2_FILES[@]}"; do
	destination="$DATA_ROOT/soundfonts/$relative_path"
	if [[ ! -e "$destination" ]]; then
		install -D -m 0644 "$SOUNDFONTS_DIR/$relative_path" "$destination"
	fi
done
touch "$DATA_ROOT/autostart"

if [[ -n "$BOOT_MOUNT" ]]; then
	grep -Fxq 'dtparam=spi=on' "$BOOT_MOUNT/config.txt" || printf '\n# SamNat Synth · MPI3501 LCD e XPT2046\ndtparam=spi=on\n' >> "$BOOT_MOUNT/config.txt"
	grep -Fq 'dtoverlay=piscreen,drm' "$BOOT_MOUNT/config.txt" || printf 'dtoverlay=piscreen,drm,rotate=90\n' >> "$BOOT_MOUNT/config.txt"
fi

sync
echo "SamNat Synth instalado no piCore: extensão, inicialização automática e ${#SF2_FILES[@]} SoundFonts de teste persistentes."
printf 'SoundFonts: %s bytes; extensão: %s bytes; reserva adicional: 512 MiB.\n' "$SF2_BYTES" "$EXT_BYTES"
echo "TCE: $TCE_DIR"
if [[ -n "$BOOT_MOUNT" ]]; then echo "Boot config atualizado: $BOOT_MOUNT/config.txt"; fi
echo "Para desativar o auto-start, remova $DATA_ROOT/autostart."
