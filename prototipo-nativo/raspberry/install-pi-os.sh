#!/bin/sh
set -eu

# Native ARM64 bring-up for the Raspberry Pi 3B+.
# This intentionally keeps downloaded archives, source trees, npm caches and
# build directories so the next run can reuse them.

APP_SOURCE=${1:-}
APP_ROOT=${SAMNAT_APP_ROOT:-/opt/samnat-synth}
CACHE_ROOT=${SAMNAT_BUILD_CACHE:-/var/cache/samnat-synth-build}
NODE_VERSION=18.12.1
NODE_ARCHIVE="node-v${NODE_VERSION}-linux-arm64.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
NODE_PREFIX="$CACHE_ROOT/node-v${NODE_VERSION}-linux-arm64"
NODE_BIN="$NODE_PREFIX/bin"
QT_PREFIX="$CACHE_ROOT/qt-system-prefix"
QODE_TAG=v18.12.1-qode
QODE_SOURCE="$CACHE_ROOT/qodejs-${QODE_TAG}"

if [ "$(id -u)" -ne 0 ] && [ "${SAMNAT_BUILD_ONLY:-0}" != 1 ]; then
	echo "Execute este script como root: sudo $0 /caminho/prototipo-nativo" >&2
	exit 1
fi
if [ "$(uname -m)" != aarch64 ] && [ "${SAMNAT_ALLOW_EMULATED_ARM64:-0}" != 1 ]; then
	echo "Este preparo precisa rodar em Linux ARM64 (Raspberry Pi OS 64-bit). Detectado: $(uname -m)" >&2
	exit 1
fi
if [ -z "$APP_SOURCE" ] || [ ! -f "$APP_SOURCE/package.json" ] || [ ! -d "$APP_SOURCE/src" ]; then
	echo "Informe a pasta prototipo-nativo do projeto como argumento." >&2
	exit 1
fi

APP_SOURCE=$(CDPATH= cd -- "$APP_SOURCE" && pwd)
mkdir -p "$CACHE_ROOT" "$APP_ROOT"

if [ "${SAMNAT_BUILD_ONLY:-0}" != 1 ]; then
	apt-get update
	DEBIAN_FRONTEND=noninteractive apt-get install -y \
		alsa-utils \
		build-essential \
		ca-certificates \
		cmake \
		curl \
		git \
		libgtk-3-dev \
		libasound2-dev \
		libasound2-plugins \
		libfluidsynth3 \
		libudev-dev \
		libgl1 \
		libopengl0 \
		fluidsynth \
		patchelf \
		pkg-config \
		qt6-base-dev \
		qt6-base-dev-tools \
		qt6-base-private-dev \
		qt6-qpa-plugins \
		qt6-svg-dev \
		libqt6svg6 \
		python3 \
		xz-utils \
		fonts-dejavu-core
fi

MULTIARCH=$(dpkg-architecture -qDEB_HOST_MULTIARCH)
QT_MULTIARCH="/usr/lib/$MULTIARCH"
if [ ! -d "$QT_MULTIARCH/cmake/Qt6" ]; then
	echo "Qt 6 CMake files not found at $QT_MULTIARCH/cmake/Qt6." >&2
	exit 1
fi

# NodeGui 0.58 hard-codes its Minimal Qt layout as <prefix>/lib/cmake/Qt6.
# Debian stores Qt in a multiarch directory, so this stable symlink prefix lets
# us use the distro's native ARM64 Qt without downloading the x86_64 MiniQt.
mkdir -p "$QT_PREFIX"
ln -sfn "$QT_MULTIARCH" "$QT_PREFIX/lib"
ln -sfn /usr/include "$QT_PREFIX/include"

if [ ! -x "$NODE_BIN/node" ]; then
	if [ ! -f "$CACHE_ROOT/$NODE_ARCHIVE" ]; then
		curl -fL --retry 3 "$NODE_URL" -o "$CACHE_ROOT/$NODE_ARCHIVE.part"
		mv "$CACHE_ROOT/$NODE_ARCHIVE.part" "$CACHE_ROOT/$NODE_ARCHIVE"
	fi
	tar -xf "$CACHE_ROOT/$NODE_ARCHIVE" -C "$CACHE_ROOT"
fi

# Copy source files into a stable install directory without clearing it. This
# preserves user data and makes repeated dependency builds incremental.
cp -a "$APP_SOURCE/package.json" "$APP_ROOT/package.json"
cp -a "$APP_SOURCE/package-lock.json" "$APP_ROOT/package-lock.json"
mkdir -p "$APP_ROOT/src"
cp -a "$APP_SOURCE/src/." "$APP_ROOT/src/"
if [ ! -f "$APP_SOURCE/deploy/linux/SamnatSynthNative/default.png" ]; then
	echo "Logo padrão ausente: $APP_SOURCE/deploy/linux/SamnatSynthNative/default.png" >&2
	exit 1
fi
mkdir -p "$APP_ROOT/deploy/linux/SamnatSynthNative"
cp -a "$APP_SOURCE/deploy/linux/SamnatSynthNative/default.png" \
	"$APP_ROOT/deploy/linux/SamnatSynthNative/default.png"
if [ "${SAMNAT_BUILD_ONLY:-0}" != 1 ] && [ -d "$APP_SOURCE/soundfonts" ]; then
	mkdir -p "$APP_ROOT/soundfonts"
	cp -an "$APP_SOURCE/soundfonts/." "$APP_ROOT/soundfonts/"
fi

export PATH="$NODE_BIN:$PATH"
export QT_INSTALL_DIR="$QT_PREFIX"
export HOME="$CACHE_ROOT/build-home"
export XDG_CACHE_HOME="$CACHE_ROOT/xdg-cache"
export npm_config_cache="$CACHE_ROOT/npm-cache"
export CMAKE_BUILD_PARALLEL_LEVEL=${SAMNAT_BUILD_JOBS:-1}
mkdir -p "$HOME" "$XDG_CACHE_HOME" "$npm_config_cache"

cd "$APP_ROOT"
npm install --omit=dev --ignore-scripts --no-audit --no-fund

QODE_BIN="$APP_ROOT/node_modules/@nodegui/qode/binaries/qode"
if [ ! -x "$QODE_BIN" ]; then
	# The pinned Qode ARM64 release URL is not published (the installer returns
	# 404), so compile the pinned source directly and reuse its persistent tree.
	echo "Qode ARM64 prebuilt is unavailable; building Qode $QODE_TAG from the cached source..."
	if [ ! -d "$QODE_SOURCE/.git" ]; then
		git clone --branch "$QODE_TAG" --depth 1 --recurse-submodules \
			https://github.com/nodegui/qodejs.git "$QODE_SOURCE"
	fi
	if [ -f "$QODE_SOURCE/qode/build.js" ]; then
		# Qode's build script defaults to every visible CPU. Under QEMU that
		# can overcommit memory badly; honor the persistent builder's job cap.
		python3 - "$QODE_SOURCE/qode/build.js" <<'PY'
from pathlib import Path
import sys

build_script = Path(sys.argv[1])
source = build_script.read_text()
old = 'make -j${os.cpus().length}'
new = 'make -j${process.env.SAMNAT_BUILD_JOBS || 1}'
if new not in source:
    if old not in source:
        raise SystemExit(f"Unrecognized Qode build.js make command: {build_script}")
    build_script.write_text(source.replace(old, new))
PY
		(cd "$QODE_SOURCE" && "$NODE_BIN/node" ./qode/build.js)
	elif [ -x "$QODE_SOURCE/configure" ]; then
		(cd "$QODE_SOURCE" && ./configure --without-npm && make -j1)
	else
		echo "Qode source build entry point is unavailable." >&2
		exit 1
	fi
	QODE_BUILT=
	for candidate in \
		"$QODE_SOURCE/node/out/Release/qode" \
		"$QODE_SOURCE/out/Release/qode" \
		"$QODE_SOURCE/qode/out/Release/qode"; do
		if [ -x "$candidate" ]; then QODE_BUILT=$candidate; break; fi
	done
	if [ -z "$QODE_BUILT" ]; then
		QODE_BUILT=$(find "$QODE_SOURCE" -type f -name qode -executable -print -quit)
	fi
	if [ -z "$QODE_BUILT" ]; then
		echo "Qode source build finished without a qode executable; source/output were kept in $QODE_SOURCE." >&2
		exit 1
	fi
	mkdir -p "$(dirname "$QODE_BIN")"
	cp -p "$QODE_BUILT" "$QODE_BIN"
fi

# Build NodeGui against the ARM64 Qt packages installed above. The source addon
# fallback is expected when no prebuilt NodeGui ARM64 artifact is published.
if [ ! -f "$APP_ROOT/node_modules/@nodegui/nodegui/build/Release/nodegui_core.node" ]; then
	(
		cd "$APP_ROOT/node_modules/@nodegui/nodegui"
		QT_INSTALL_DIR="$QT_PREFIX" CMAKE_BUILD_PARALLEL_LEVEL="$CMAKE_BUILD_PARALLEL_LEVEL" \
			"$APP_ROOT/node_modules/.bin/cmake-js" compile
	)
fi

if [ ! -f "$APP_ROOT/node_modules/midi/build/Release/midi.node" ]; then
	(cd "$APP_ROOT" && npm rebuild midi --build-from-source --foreground-scripts)
fi

if [ ! -x "$QODE_BIN" ] || [ ! -f "$APP_ROOT/node_modules/@nodegui/nodegui/build/Release/nodegui_core.node" ] || \
	[ ! -f "$APP_ROOT/node_modules/midi/build/Release/midi.node" ]; then
	echo "Runtime ARM64 incompleto; fontes e cache foram preservados em $CACHE_ROOT e $APP_ROOT." >&2
	exit 1
fi

if [ "${SAMNAT_BUILD_ONLY:-0}" = 1 ]; then
	"$APP_SOURCE/raspberry/package-arm64-appdir.sh" \
		"$APP_SOURCE" "$APP_ROOT" "${SAMNAT_APPDIR:-$APP_ROOT/build/SamNatSynthARM64.AppDir}"
	echo "AppDir ARM64 empacotado em ${SAMNAT_APPDIR:-$APP_ROOT/build/SamNatSynthARM64.AppDir}."
	exit 0
fi

install -m 0644 "$APP_SOURCE/raspberry/samnat-synth.service" /etc/systemd/system/samnat-synth.service
install -m 0755 "$APP_SOURCE/raspberry/samnat-pi-session" /usr/local/bin/samnat-pi-session
if [ ! -f /etc/default/samnat-synth ]; then
	install -m 0644 "$APP_SOURCE/raspberry/samnat-pi.env" /etc/default/samnat-synth
fi

BOOT_CONFIG=
if [ -f /boot/firmware/config.txt ]; then
	BOOT_CONFIG=/boot/firmware/config.txt
elif [ -f /boot/config.txt ]; then
	BOOT_CONFIG=/boot/config.txt
fi
if [ -n "$BOOT_CONFIG" ]; then
	grep -q '^dtparam=spi=on$' "$BOOT_CONFIG" || printf '\n# SamNat Synth · MPI3501 SPI LCD and XPT2046 touch\ndtparam=spi=on\n' >> "$BOOT_CONFIG"
	grep -q '^dtoverlay=piscreen,drm' "$BOOT_CONFIG" || printf 'dtoverlay=piscreen,drm,rotate=90\n' >> "$BOOT_CONFIG"
else
	echo "config.txt do boot não encontrado; aplique o overlay MPI3501 manualmente." >&2
fi

id samnat >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/samnat --shell /usr/sbin/nologin samnat
install -d -o root -g root -m 0755 /home/samnat/.samnat-synth/soundfonts
if [ -d "$APP_ROOT/soundfonts" ]; then
	# Expose the bundled library in the file picker without storing a second
	# 2.9 GB copy on the boot drive. Existing user files are left untouched.
	for bundled_item in "$APP_ROOT/soundfonts/"*; do
		[ -e "$bundled_item" ] || continue
		target="/home/samnat/.samnat-synth/soundfonts/${bundled_item##*/}"
		if [ ! -e "$target" ] && [ ! -L "$target" ]; then
			ln -s "$bundled_item" "$target"
		fi
	done
fi
chown -R root:root /home/samnat/.samnat-synth

systemctl daemon-reload
systemctl enable samnat-synth.service

cat <<EOF
SamNat ARM64 preparado em $APP_ROOT.
Cache persistente: $CACHE_ROOT
AppDir ARM64 para a imagem Buildroot: $APP_ROOT/build/SamNatSynthARM64.AppDir
Reinicie para aplicar o overlay MPI3501 e iniciar o app:
  sudo reboot
Logs do app:
  journalctl -u samnat-synth -b
EOF
