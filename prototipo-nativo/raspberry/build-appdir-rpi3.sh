#!/usr/bin/env bash
set -euo pipefail

RASPBERRY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$RASPBERRY_DIR/.." && pwd)
APPDIR_PATH=${SAMNAT_APPDIR:-$RASPBERRY_DIR/build/SamNatSynthARM64.AppDir}
APPDIR_HOST=$(dirname -- "$APPDIR_PATH")
APPDIR_NAME=$(basename -- "$APPDIR_PATH")
WORK_ROOT=${SAMNAT_RPI_ARM64_WORK:-$PROJECT_ROOT/.cache/rpi3-arm64-work}
DOCKER_COMMAND=${DOCKER_COMMAND:-docker}
BUILD_JOBS=${SAMNAT_BUILD_JOBS:-1}
BUILDER_NAME=${SAMNAT_RPI_ARM64_CONTAINER:-samnat-rpi3-arm64-builder}
BUILDER_IMAGE=${SAMNAT_RPI_ARM64_IMAGE:-python:3.10-slim-bookworm}

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
if [[ -n ${SAMNAT_RPI_ARM64_IMAGE:-} ]] && ! "${DOCKER_CMD[@]}" image inspect "$BUILDER_IMAGE" >/dev/null 2>&1; then
	echo "A imagem ARM64 informada não existe localmente: $BUILDER_IMAGE" >&2
	echo "Remova SAMNAT_RPI_ARM64_IMAGE para usar a imagem base e instalar as dependências uma vez." >&2
	exit 1
fi

mkdir -p "$WORK_ROOT/cache" "$WORK_ROOT/app-root" \
	"$WORK_ROOT/apt-cache/archives" "$WORK_ROOT/apt-lists" "$APPDIR_HOST"

if ! command -v flock >/dev/null 2>&1; then
	echo "flock não encontrado no Ubuntu; instale util-linux para serializar o acesso ao container de build." >&2
	exit 1
fi
exec 9>"$WORK_ROOT/builder-operation.lock"
if ! flock -n 9; then
	echo "Outra operação já está usando o container $BUILDER_NAME. Isso bloqueia apenas outra execução do mesmo alvo; o build Raspberry no container separado pode continuar." >&2
	echo "Aguarde este build terminar antes de iniciar outro build piCore." >&2
	exit 1
fi

if ! "${DOCKER_CMD[@]}" container inspect "$BUILDER_NAME" >/dev/null 2>&1; then
	echo "Criando o container persistente $BUILDER_NAME..."
	"${DOCKER_CMD[@]}" create --platform linux/arm64 \
		--name "$BUILDER_NAME" \
		--label com.samnat.builder=rpi3-arm64-v1 \
		-v "$PROJECT_ROOT:/src:ro" \
		-v "$WORK_ROOT/cache:/cache" \
		-v "$WORK_ROOT/apt-cache:/var/cache/apt" \
		-v "$WORK_ROOT/apt-lists:/var/lib/apt/lists" \
		-v "$WORK_ROOT/app-root:/work/app-root" \
		-v "$APPDIR_HOST:/out" \
		-w /src \
		"$BUILDER_IMAGE" sleep infinity >/dev/null
	elif [[ $("${DOCKER_CMD[@]}" inspect --format '{{ index .Config.Labels "com.samnat.builder" }}' "$BUILDER_NAME") != rpi3-arm64-v1 ]]; then
		echo "Já existe um container chamado $BUILDER_NAME que não pertence a este build." >&2
		echo "Defina SAMNAT_RPI_ARM64_CONTAINER com outro nome para preservar ambos." >&2
		exit 1
fi

show_builder_diagnostics() {
	local container_logs
	container_logs=$("${DOCKER_CMD[@]}" logs --tail 30 "$BUILDER_NAME" 2>&1 || true)
	if [[ -n "$container_logs" ]]; then
		printf '%s\n' "$container_logs" >&2
	fi
	if [[ "$container_logs" == *"exec format error"* ]]; then
		echo "O handler QEMU/binfmt ARM64 não está ativo no kernel deste host." >&2
		echo "Ative-o com: sudo docker run --privileged --rm tonistiigi/binfmt --install arm64" >&2
	fi
}

CONTAINER_STATE=$("${DOCKER_CMD[@]}" inspect --format '{{.State.Status}}' "$BUILDER_NAME")
if [[ "$CONTAINER_STATE" != running ]]; then
	echo "Reiniciando o container persistente $BUILDER_NAME (estado: $CONTAINER_STATE)..."
	if ! "${DOCKER_CMD[@]}" start "$BUILDER_NAME" >/dev/null; then
		echo "O Docker não conseguiu iniciar o container $BUILDER_NAME." >&2
		show_builder_diagnostics
		exit 1
	fi
fi

for attempt in {1..10}; do
	CONTAINER_STATE=$("${DOCKER_CMD[@]}" inspect --format '{{.State.Status}}' "$BUILDER_NAME")
	[[ "$CONTAINER_STATE" == running ]] && break
	sleep 1
done
if [[ "$CONTAINER_STATE" != running ]]; then
	echo "O container $BUILDER_NAME não permaneceu ativo após a inicialização (estado: $CONTAINER_STATE)." >&2
	show_builder_diagnostics
	exit 1
fi

echo "Verificando execução ARM64 via QEMU/binfmt no container persistente..."
if ! ARCH_OUTPUT=$("${DOCKER_CMD[@]}" exec "$BUILDER_NAME" uname -m 2>&1); then
	echo "$ARCH_OUTPUT" >&2
	echo "O container está ativo, mas não foi possível executar uname dentro dele." >&2
	echo "Últimas mensagens do container $BUILDER_NAME:" >&2
	show_builder_diagnostics
	if [[ "$ARCH_OUTPUT" == *"exec format error"* ]]; then
		echo "Isso indica que o QEMU/binfmt ARM64 não está disponível. Configure com: sudo docker run --privileged --rm tonistiigi/binfmt --install arm64" >&2
	fi
	exit 1
fi
if [[ "$ARCH_OUTPUT" != aarch64 ]]; then
	echo "O container deveria informar aarch64; informou: $ARCH_OUTPUT" >&2
	exit 1
fi

if ! "${DOCKER_CMD[@]}" exec "$BUILDER_NAME" test -f /cache/.samnat-arm64-build-deps-v2-ready; then
	echo "Instalando dependências ARM64 pela primeira vez no container persistente..."
	"${DOCKER_CMD[@]}" exec -e DEBIAN_FRONTEND=noninteractive "$BUILDER_NAME" /bin/sh -ec '
		rm -f /etc/apt/apt.conf.d/docker-clean
		apt-get update
		set -- alsa-utils binutils build-essential ca-certificates cmake curl dpkg-dev file fonts-dejavu-core git fluidsynth libasound2-dev libasound2-plugins libfluidsynth3 libgl1 libgtk-3-dev libopengl0 libudev-dev libqt6svg6 patchelf pkg-config qt6-base-dev qt6-base-dev-tools qt6-base-private-dev qt6-qpa-plugins qt6-svg-dev util-linux xz-utils
		apt-get install -y "$@"
		python3 --version
		python3 --version | grep -Eq '^Python 3\.10\.'
		touch /cache/.samnat-arm64-build-deps-v2-ready
	'
fi

if [[ ${SAMNAT_SKIP_APPDIR_BUILD:-0} == 1 ]]; then
	echo "Container persistente e dependências ARM64 prontos; compilação do AppDir ignorada."
	echo "Dependências instaladas preservadas no container: $BUILDER_NAME"
	exit 0
fi

echo "Compilando o app no container persistente $BUILDER_NAME..."
"${DOCKER_CMD[@]}" exec \
	-e HOST_UID="$(id -u)" \
	-e HOST_GID="$(id -g)" \
	-e BUILD_JOBS="$BUILD_JOBS" \
	-e APPDIR_NAME="$APPDIR_NAME" \
	"$BUILDER_NAME" /bin/sh -ec '
		python3 --version
		setpriv --reuid "$HOST_UID" --regid "$HOST_GID" --clear-groups \
			env HOME=/cache/home \
				SAMNAT_BUILD_ONLY=1 \
				SAMNAT_ALLOW_EMULATED_ARM64=1 \
				SAMNAT_BUILD_CACHE=/cache \
				SAMNAT_APP_ROOT=/work/app-root \
				SAMNAT_APPDIR="/out/$APPDIR_NAME" \
				SAMNAT_BUILD_JOBS="$BUILD_JOBS" \
				/src/raspberry/build-arm64-runtime.sh /src
	'

echo "AppDir ARM64 pronto em: $APPDIR_PATH"
echo "Caches e fontes intermediárias preservados em: $WORK_ROOT"
echo "Dependências instaladas preservadas no container: $BUILDER_NAME"
