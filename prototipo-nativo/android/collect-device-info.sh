#!/usr/bin/env bash
set -euo pipefail

OUTPUT=${1:-/tmp/moto-g52-android-inventory.txt}

if ! command -v adb >/dev/null 2>&1; then
  echo "adb não foi encontrado. Instale o Android Platform Tools e tente novamente." >&2
  exit 1
fi

if [[ "$(adb get-state 2>/dev/null || true)" != "device" ]]; then
  echo "Nenhum aparelho autorizado pelo adb. Conecte o Moto G52, ative Depuração USB e aceite a autorização na tela." >&2
  exit 1
fi

{
  echo "SamNat Synth — inventário somente leitura do Android"
  echo "Gerado em: $(date -Is)"
  echo

  echo "=== Modelo e build ==="
  for property in \
    ro.product.model \
    ro.product.device \
    ro.product.name \
    ro.build.fingerprint \
    ro.build.version.release \
    ro.build.version.sdk \
    ro.product.cpu.abilist \
    ro.boot.flash.locked \
    ro.boot.verifiedbootstate; do
    printf '%s: ' "$property"
    adb shell getprop "$property" | tr -d '\r'
  done
  echo

  echo "=== Espaço das partições ==="
  adb shell df -h /system /vendor /data 2>&1 | tr -d '\r'
  echo

  echo "=== Aplicativos instalados para o usuário ==="
  adb shell pm list packages -3 2>&1 | tr -d '\r'
  echo

  echo "=== Pacotes de sistema (inventário para avaliar debloat) ==="
  adb shell pm list packages -s 2>&1 | tr -d '\r'
  echo

  echo "=== Recursos de hardware anunciados ==="
  adb shell pm list features 2>&1 | tr -d '\r'
  echo

  echo "=== Estado de provisionamento ==="
  printf 'device_provisioned: '
  adb shell settings get global device_provisioned | tr -d '\r'
  printf 'user_setup_complete: '
  adb shell settings get secure user_setup_complete | tr -d '\r'
} > "$OUTPUT"

echo "Inventário salvo em: $OUTPUT"
echo "O script só consultou propriedades e pacotes; não alterou o telefone."
