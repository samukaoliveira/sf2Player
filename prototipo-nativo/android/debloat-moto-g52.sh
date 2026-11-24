#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
adb_bin="${ADB:-adb}"
mapfile -t attached_devices < <("$adb_bin" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
if [[ "${#attached_devices[@]}" -ne 1 ]]; then
  echo "Conecte somente o Moto G52 via USB e confirme a depuração ADB. Dispositivos ativos: ${#attached_devices[@]}" >&2
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
mkdir -p "$state_root"
state_file="$state_root/disabled-by-samnat-${device_serial}.txt"
touch "$state_file"
mapfile -t installed_packages < <("$adb_bin" -s "$device_serial" shell pm list packages --user 0 | tr -d '\r' | sed 's/^package://')
mapfile -t disabled_packages < <("$adb_bin" -s "$device_serial" shell pm list packages -d --user 0 | tr -d '\r' | sed 's/^package://')

echo "Moto G52 confirmado: $model_name ($device_codename)"
while IFS= read -r package_name || [[ -n "$package_name" ]]; do
  [[ -z "$package_name" || "$package_name" == \#* ]] && continue
  if ! printf '%s\n' "${installed_packages[@]}" | grep -Fxq "$package_name"; then
    continue
  fi
  if printf '%s\n' "${disabled_packages[@]}" | grep -Fxq "$package_name"; then
    echo "Já estava desativado; mantido: $package_name"
    continue
  fi
  result="$("$adb_bin" -s "$device_serial" shell pm disable-user --user 0 "$package_name" </dev/null 2>&1 | tr -d '\r')"
  if [[ "$result" == *"new state: disabled-user"* ]]; then
    if ! grep -Fxq "$package_name" "$state_file"; then printf '%s\n' "$package_name" >> "$state_file"; fi
    echo "Desativado: $package_name"
  else
    echo "Não foi possível desativar $package_name: $result" >&2
  fi
done < "$script_dir/moto-g52-background-packages.txt"

echo "Lista para restauração: $state_file"
