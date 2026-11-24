#!/usr/bin/env bash
set -euo pipefail

RASPBERRY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$RASPBERRY_DIR/.." && pwd)
APPDIR_PATH=${SAMNAT_APPDIR:-$RASPBERRY_DIR/build/SamNatSynthARM64.AppDir}
APPDIR_HOST=$(dirname -- "$APPDIR_PATH")
APPDIR_NAME=$(basename -- "$APPDIR_PATH")
WORK_ROOT=${SAMNAT_RPI_ARM64_WORK:-/tmp/samnat-rpi3-arm64-work}
DOCKER_COMMAND=${DOCKER_COMMAND:-docker}
BUILD_JOBS=${SAMNAT_BUILD_JOBS:-1}

read -r -a DOCKER_CMD <<< "$DOCKER_COMMAND"
if ! command -v "${DOCKER_CMD[0]}" >/dev/null 2>&1; then
	echo "Docker não foi encontrado. Instale/inicie o Docker Engine no Ubuntu." >&2
	exit 1
fi
if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
	echo "O Docker está instalado, mas o usuário não consegue acessar o daemon." >&2
	echo "Entre no grupo docker e abra uma nova sessão, ou rode com DOCKER_COMMAND='sudo docker'." >&2
	exit 1
fi

mkdir -p "$WORK_ROOT/cache" "$WORK_ROOT/app-root" \
	"$WORK_ROOT/apt-cache/archives" "$WORK_ROOT/apt-lists" "$APPDIR_HOST"

echo "Verificando execução ARM64 via QEMU/binfmt..."
if ! ARCH_OUTPUT=$("${DOCKER_CMD[@]}" run --rm --platform linux/arm64 \
	python:3.10-slim-bookworm uname -m); then
	echo "O host ainda não está configurado para executar containers ARM64." >&2
	echo "Configure uma vez com: sudo docker run --privileged --rm tonistiigi/binfmt --install arm64" >&2
	exit 1
fi
if [[ "$ARCH_OUTPUT" != aarch64 ]]; then
	echo "O container deveria informar aarch64; informou: $ARCH_OUTPUT" >&2
	exit 1
fi

echo "Instalando dependências no container ARM64 e compilando o app..."
"${DOCKER_CMD[@]}" run --rm --platform linux/arm64 \
	-e HOST_UID="$(id -u)" \
	-e HOST_GID="$(id -g)" \
	-v "$PROJECT_ROOT:/src:ro" \
	-v "$WORK_ROOT/cache:/cache" \
	-v "$WORK_ROOT/apt-cache:/var/cache/apt" \
	-v "$WORK_ROOT/apt-lists:/var/lib/apt/lists" \
	-v "$WORK_ROOT/app-root:/work/app-root" \
	-v "$APPDIR_HOST:/out" \
	-w /src \
	python:3.10-slim-bookworm \
	/bin/sh -ec '
		rm -f /etc/apt/apt.conf.d/docker-clean
		apt-get update
		apt-get install -y \
			alsa-utils binutils build-essential ca-certificates cmake curl dpkg-dev \
			file fonts-dejavu-core git libasound2-dev libasound2-plugins libfluidsynth3 \
			libgl1 libgtk-3-dev libopengl0 libudev-dev libqt6svg6 patchelf pkg-config \
			qt6-base-dev qt6-base-dev-tools qt6-base-private-dev qt6-qpa-plugins \
			qt6-svg-dev util-linux xz-utils
		python3 -c "import sys; assert sys.version_info[:2] == (3, 10), sys.version"
		python3 --version
		setpriv --reuid "$HOST_UID" --regid "$HOST_GID" --clear-groups \
			env HOME=/cache/home \
				SAMNAT_BUILD_ONLY=1 \
				SAMNAT_ALLOW_EMULATED_ARM64=1 \
				SAMNAT_BUILD_CACHE=/cache \
				SAMNAT_APP_ROOT=/work/app-root \
				SAMNAT_APPDIR="/out/'"$APPDIR_NAME"'" \
				SAMNAT_BUILD_JOBS="'"$BUILD_JOBS"'" \
				/src/raspberry/build-arm64-runtime.sh /src
	'

echo "AppDir ARM64 pronto em: $APPDIR_PATH"
echo "Caches e fontes intermediárias preservados em: $WORK_ROOT"
