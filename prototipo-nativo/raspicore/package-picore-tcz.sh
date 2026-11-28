#!/usr/bin/env bash
set -euo pipefail

RASPICORE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$RASPICORE_DIR/.." && pwd)
export SAMNAT_APPDIR=${SAMNAT_APPDIR:-$RASPICORE_DIR/build/SamNatSynthARM64.AppDir}
export SAMNAT_RPI_ARM64_WORK=${SAMNAT_RPI_ARM64_WORK:-$PROJECT_ROOT/.cache/picore-arm64-work}
export SAMNAT_RPI_ARM64_CONTAINER=${SAMNAT_RPI_ARM64_CONTAINER:-samnat-picore-arm64-builder}
APPDIR=$SAMNAT_APPDIR
WORK_ROOT=$SAMNAT_RPI_ARM64_WORK
OUTPUT_DIR=${SAMNAT_PICORE_OUTPUT:-$RASPICORE_DIR/release-picore}
DOCKER_COMMAND=${DOCKER_COMMAND:-docker}
BUILDER_NAME=$SAMNAT_RPI_ARM64_CONTAINER
BUILD_ID=$(date +%Y%m%d-%H%M%S)
STAGE="$WORK_ROOT/app-root/picore-stage-$BUILD_ID"
ROOTFS="$STAGE/root"
EXTENSION="$OUTPUT_DIR/SamNatSynth.tcz"
APPDIR_NAME=$(basename -- "$APPDIR")

read -r -a DOCKER_CMD <<< "$DOCKER_COMMAND"
if ! command -v "${DOCKER_CMD[0]}" >/dev/null 2>&1; then
	echo "Docker não foi encontrado." >&2
	exit 1
fi
if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
	echo "Não foi possível acessar o daemon Docker. Use DOCKER_COMMAND='sudo docker' se necessário." >&2
	exit 1
fi
if [[ ! -x "$APPDIR/AppRun" || ! -x "$APPDIR/qode" ]]; then
	echo "AppDir ARM64 ausente em $APPDIR. Gere-o primeiro com raspberry/build-appdir-rpi3.sh." >&2
	exit 1
fi
if ! command -v mksquashfs >/dev/null 2>&1; then
	echo "mksquashfs não encontrado. Instale squashfs-tools no Ubuntu e repita." >&2
	exit 1
fi
if ! command -v md5sum >/dev/null 2>&1; then
	echo "md5sum não encontrado no Ubuntu." >&2
	exit 1
fi

if ! "${DOCKER_CMD[@]}" container inspect "$BUILDER_NAME" >/dev/null 2>&1; then
	echo "Inicializando o container e as dependências ARM64 sem recompilar o AppDir existente..."
	DOCKER_COMMAND="$DOCKER_COMMAND" SAMNAT_SKIP_APPDIR_BUILD=1 "$PROJECT_ROOT/raspberry/build-appdir-rpi3.sh"
fi
if ! "${DOCKER_CMD[@]}" exec "$BUILDER_NAME" test -f /cache/.samnat-arm64-build-deps-v2-ready; then
	echo "Instalando ferramentas de runtime ARM64 que faltam para a extensão piCore..."
	DOCKER_COMMAND="$DOCKER_COMMAND" SAMNAT_SKIP_APPDIR_BUILD=1 "$PROJECT_ROOT/raspberry/build-appdir-rpi3.sh"
fi
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
if [[ $("${DOCKER_CMD[@]}" inspect --format '{{.State.Running}}' "$BUILDER_NAME") != true ]]; then
	"${DOCKER_CMD[@]}" start "$BUILDER_NAME" >/dev/null
fi
if ! "${DOCKER_CMD[@]}" exec "$BUILDER_NAME" /bin/sh -ec 'for command in fluidsynth aplay amixer aseqdump; do command -v "$command" >/dev/null; done'; then
	echo "Faltam comandos de áudio dentro do container ARM64. Rode raspberry/build-appdir-rpi3.sh para instalá-los." >&2
	exit 1
fi

mkdir -p "$STAGE" "$OUTPUT_DIR"

echo "Montando extensão piCore a partir do AppDir ARM64..."

"${DOCKER_CMD[@]}" exec \
	-e HOST_UID="$(id -u)" \
	-e HOST_GID="$(id -g)" \
	-e APPDIR_NAME="$APPDIR_NAME" \
	-e STAGE_NAME="$(basename -- "$STAGE")" \
	"$BUILDER_NAME" \
	/bin/sh -ec '
		setpriv --reuid "$HOST_UID" --regid "$HOST_GID" --clear-groups \
			/bin/sh /src/raspicore/package-picore-in-container.sh "/out/$APPDIR_NAME" "/work/app-root/$STAGE_NAME/root"
	'

	command -v convert >/dev/null || { echo 'ImageMagick (convert) é necessário para preparar o logo do boot.' >&2; exit 1; }
	mkdir -p "$ROOTFS/opt/samnat-synth/share/samnat" "$ROOTFS/usr/local/bin"
	logo="$PROJECT_ROOT/deploy/linux/SamnatSynthNative/default.png"
	[[ -f "$logo" ]] || { echo "Logo ausente: $logo" >&2; exit 1; }
	{ printf 'P6\n220 100\n255\n'; convert "$logo" -resize 220x100 -background '#0e1726' -alpha remove -alpha off -gravity center -extent 220x100 -depth 8 rgb:-; } > "$ROOTFS/opt/samnat-synth/share/samnat/boot-logo.ppm"
	"${DOCKER_CMD[@]}" exec -e STAGE_NAME="$(basename -- "$STAGE")" "$BUILDER_NAME" /bin/sh -ec 'gcc -static -O2 -o "/work/app-root/$STAGE_NAME/root/usr/local/bin/samnat-splash" /src/raspicore/samnat-splash.c'

	install -D -m 0755 "$RASPICORE_DIR/samnat-picore-launch" "$ROOTFS/usr/local/bin/samnat-picore-launch"
	install -D -m 0755 "$RASPICORE_DIR/samnat-picore-volume" "$ROOTFS/usr/local/bin/samnat-volume"
	install -D -m 0755 "$RASPICORE_DIR/samnat-picore-check" "$ROOTFS/usr/local/bin/samnat-picore-check"
	install -d "$ROOTFS/usr/local/tce.installed"
	cat > "$ROOTFS/usr/local/tce.installed/SamNatSynth" <<'TCE_INSTALL'
#!/bin/sh
set -eu
TCE_DIR=$(readlink -f /etc/sysconfig/tcedir 2>/dev/null || true)
[ -n "$TCE_DIR" ] || exit 0
AUTOSTART="$TCE_DIR/samnat-synth-data/autostart"
[ -f "$AUTOSTART" ] || exit 0
LOG="$TCE_DIR/samnat-synth-data/logs/startup.log"
mkdir -p "$(dirname "$LOG")"
(
	# Graphics and touchscreen extensions are ordered before this extension.
	for entry in /sys/class/graphics/fb*; do
		[ -r "$entry/name" ] || continue
		case "$(cat "$entry/name")" in
			*ili9486*|*ILI9486*|*piscreen*)
				chvt 2 2>/dev/null || true
				/usr/local/bin/samnat-splash "/dev/${entry##*/}" /opt/samnat-synth/share/samnat/boot-logo.ppm 20 || true
				break ;;
		esac
	done
	sleep 8
	printf '\nSamNat: iniciando launcher\n' >>"$LOG"
	if /usr/local/bin/samnat-picore-launch >>"$LOG" 2>&1; then
		printf 'SamNat: launcher encerrou com código 0\n' >>"$LOG"
	else
		code=$?
		printf 'SamNat: launcher encerrou com código %s\n' "$code" >>"$LOG"
	fi
	chvt 1 2>/dev/null || true
) </dev/null >/dev/null 2>&1 &
TCE_INSTALL
	chmod 0755 "$ROOTFS/usr/local/tce.installed/SamNatSynth"
	chmod 0755 "$ROOTFS/opt/samnat-synth/AppRun" "$ROOTFS/opt/samnat-synth/qode"

# AppDir is generated by the ARM64 container. mksquashfs on the Ubuntu host
# avoids spending emulated CPU time compressing a large Qt/Node runtime.
mksquashfs "$ROOTFS" "$EXTENSION" -noappend -all-root -b 4096 -no-xattrs -comp gzip >/dev/null
(cd "$OUTPUT_DIR" && printf '%s\n' 'alsa.tcz' > "$(basename "$EXTENSION").dep")
(cd "$OUTPUT_DIR" && md5sum "$(basename "$EXTENSION")" > "$(basename "$EXTENSION").md5.txt")

echo "Extensão piCore criada: $EXTENSION"
echo "Staging ARM64 preservado em: $STAGE"
