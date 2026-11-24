#!/usr/bin/env bash
set -euo pipefail

adb_bin="${ADB:-adb}"
mapfile -t attached_devices < <("$adb_bin" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
if [[ "${#attached_devices[@]}" -ne 1 ]]; then
  echo "Conecte somente o Moto G52 usado para aplicar a otimização. Dispositivos ativos: ${#attached_devices[@]}" >&2
  exit 1
fi
device_serial="${attached_devices[0]}"
model_name="$("$adb_bin" -s "$device_serial" shell getprop ro.product.model | tr -d '\r')"
device_codename="$("$adb_bin" -s "$device_serial" shell getprop ro.product.device | tr -d '\r')"
if [[ "${model_name,,}" != *"moto g52"* && "$device_codename" != "rhode" ]]; then
  echo "Dispositivo encontrado não parece ser o Moto G52: modelo='$model_name', device='$device_codename'. Nada foi alterado." >&2
  exit 1
fi

state_root="${XDG_STATE_HOME:-$HOME/.local/state}/samnat-moto-g52"
state_file="$state_root/disabled-by-samnat-${device_serial}.txt"
if [[ ! -f "$state_file" ]]; then
  echo "Não achei a lista de pacotes desativados por este script: $state_file" >&2
  exit 1
fi

while IFS= read -r package_name || [[ -n "$package_name" ]]; do
  [[ -z "$package_name" ]] && continue
  "$adb_bin" -s "$device_serial" shell pm enable --user 0 "$package_name" </dev/null
done < "$state_file"
mv "$state_file" "$state_file.restored"
echo "Pacotes restaurados. O inventário anterior foi guardado em $state_file.restored"
