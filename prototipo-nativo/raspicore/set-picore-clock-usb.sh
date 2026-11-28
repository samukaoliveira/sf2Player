#!/usr/bin/env bash
set -euo pipefail
boot=${1:?Informe o ponto de montagem da partição de boot}
mountpoint -q "$boot" || { echo "Partição não montada: $boot" >&2; exit 1; }
config="$boot/config.txt"
[[ -f "$config" ]] && grep -q 'modules-6.1.68-piCore-v8.gz' "$config" || { echo 'Configuração piCore esperada não encontrada.' >&2; exit 1; }
cp -n "$config" "$boot/config.before-samnat-clock.txt"
tmp=$(mktemp "$boot/.samnat-clock.XXXXXX")
awk '
  /^# BEGIN SAMNAT PI3 CLOCK$/ { skip=1; next }
  /^# END SAMNAT PI3 CLOCK$/ { skip=0; next }
  !skip { print }
' "$config" > "$tmp"
printf '\n# BEGIN SAMNAT PI3 CLOCK\n[pi3]\narm_boost=0\narm_freq=1200\n[all]\n# END SAMNAT PI3 CLOCK\n' >> "$tmp"
mv "$tmp" "$config"
sync
echo 'Clock ARM máximo configurado em 1200 MHz para o Pi 3. Backup: config.before-samnat-clock.txt'
