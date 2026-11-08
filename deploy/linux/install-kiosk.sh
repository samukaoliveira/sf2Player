#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Execute como root: sudo $0 <pasta-linux-unpacked> [usuario]" >&2
  exit 1
fi

bundle_dir=${1:-}
kiosk_user=${2:-samnat}
app_dir=/opt/samnat-synth

if [[ -z "$bundle_dir" || ! -x "$bundle_dir/samnat-synth" ]]; then
  echo "Pasta do app inválida; informe o diretório linux-unpacked do electron-builder." >&2
  exit 1
fi

case "$(uname -m)" in
  aarch64|arm64) host_arch=arm64 ;;
  x86_64|amd64) host_arch=x64 ;;
  *) echo "Arquitetura não suportada: $(uname -m)" >&2; exit 1 ;;
esac

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Este instalador requer Debian, Raspberry Pi OS ou derivado com apt-get." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update

choose_package() {
  local candidate
  for candidate in "$@"; do
    if apt-cache show "$candidate" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

alsa_package=$(choose_package libasound2t64 libasound2)
atk_package=$(choose_package libatk-bridge2.0-0t64 libatk-bridge2.0-0)
gtk_package=$(choose_package libgtk-3-0t64 libgtk-3-0)

apt-get install -y --no-install-recommends \
  ca-certificates \
  file \
  "$alsa_package" \
  "$atk_package" \
  libdrm2 \
  libgbm1 \
  "$gtk_package" \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  network-manager \
  x11-xserver-utils \
  xinit \
  xserver-xorg-core

binary_description=$(file "$bundle_dir/samnat-synth")
case "$host_arch:$binary_description" in
  arm64:*aarch64*|x64:*x86-64*) ;;
  *) echo "O executável do pacote não corresponde à arquitetura $host_arch: $binary_description" >&2; exit 1 ;;
esac

if ! id "$kiosk_user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$kiosk_user"
fi

for group_name in audio video render input; do
  if getent group "$group_name" >/dev/null; then
    usermod -aG "$group_name" "$kiosk_user"
  fi
done

install -d -o root -g root -m 0755 "$app_dir"
cp -a "$bundle_dir"/. "$app_dir"/
chown -R root:root "$app_dir"
chmod 0755 "$app_dir/samnat-synth"

# Electron's Chromium sandbox requires this helper to be root-owned and setuid.
if [[ -f "$app_dir/chrome-sandbox" ]]; then
  chown root:root "$app_dir/chrome-sandbox"
  chmod 4755 "$app_dir/chrome-sandbox"
fi

install -m 0755 "$(dirname "$0")/kiosk-session.sh" "$app_dir/kiosk-session.sh"

user_home=$(getent passwd "$kiosk_user" | cut -d: -f6)
profile_file="$user_home/.bash_profile"
touch "$profile_file"
if ! grep -q 'SAMNAT_SYNTH_KIOSK' "$profile_file"; then
cat >>"$profile_file" <<'PROFILE'
# SAMNAT_SYNTH_KIOSK: start the synth on the first virtual terminal.
if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx /opt/samnat-synth/kiosk-session.sh -- :0 vt1 -keeptty
fi
PROFILE
fi
chown "$kiosk_user" "$profile_file"

install -d -m 0755 /etc/systemd/system/getty@tty1.service.d
cat >/etc/systemd/system/getty@tty1.service.d/autologin.conf <<UNIT
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $kiosk_user --noclear %I \$TERM
UNIT

systemctl enable NetworkManager
systemctl enable getty@tty1.service
systemctl daemon-reload

echo "Kiosk instalado. Reinicie e configure a rede com nmcli antes de baixar timbres."
