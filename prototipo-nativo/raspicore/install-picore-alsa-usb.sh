#!/usr/bin/env bash
set -Eeuo pipefail

LOGIN_USER=${SUDO_USER:-${USER:-samuka}}
TCE_MOUNT=${1:-/media/$LOGIN_USER/piCore64_TCE}
BOOT_MOUNT=${2:-/media/$LOGIN_USER/piCore64_14}
BASE_URL='https://distro.ibiblio.org/tinycorelinux/14.x/aarch64/tcz'
LOG_FILE=${SAMNAT_LOG_FILE:-/tmp/samnat-picore-alsa-$(date +%Y%m%d-%H%M%S).log}

exec > >(tee -a "$LOG_FILE") 2>&1

pause_if_interactive() {
	if [[ -t 0 ]]; then
		read -r -p 'Pressione Enter para fechar esta janela...' _ || true
	fi
}

fail() {
	printf '\nERRO: %s\nLog completo: %s\n' "$*" "$LOG_FILE" >&2
	trap - ERR
	pause_if_interactive
	exit 1
}

on_error() {
	local status=$1
	local line=$2
	local command=$3
	trap - ERR
	printf '\nERRO inesperado (código %s), linha %s:\n  %s\nLog completo: %s\n' \
		"$status" "$line" "$command" "$LOG_FILE" >&2
	pause_if_interactive
	exit "$status"
}

trap 'on_error "$?" "$LINENO" "$BASH_COMMAND"' ERR

printf 'SamNat piCore — instalação offline das extensões ALSA\n'
printf 'Log: %s\n' "$LOG_FILE"
printf 'Partição TCE: %s\nPartição boot: %s\n\n' "$TCE_MOUNT" "$BOOT_MOUNT"

for tool in cmp curl findmnt grep install lsblk md5sum mountpoint mktemp sync tee; do
	command -v "$tool" >/dev/null 2>&1 || fail "Comando necessário não encontrado: $tool"
done

mountpoint -q "$TCE_MOUNT" || fail "A partição TCE não está montada em $TCE_MOUNT. Monte a partição ext4 e tente novamente."
mountpoint -q "$BOOT_MOUNT" || fail "A partição de boot não está montada em $BOOT_MOUNT. Monte a partição FAT e tente novamente."

SOURCE_DEVICE=$(findmnt -n -o SOURCE --target "$TCE_MOUNT") || fail "Não consegui identificar o dispositivo montado em $TCE_MOUNT."
DEVICE_LABEL=$(lsblk -dnro LABEL "$SOURCE_DEVICE" 2>/dev/null || true)
[[ "$DEVICE_LABEL" == 'piCore64_TCE' ]] || fail "O dispositivo $SOURCE_DEVICE tem rótulo '$DEVICE_LABEL', esperado 'piCore64_TCE'. Nada foi copiado."
[[ -f "$BOOT_MOUNT/config.txt" ]] || fail "Não encontrei config.txt em $BOOT_MOUNT."

TCE_DIR="$TCE_MOUNT/tce"
OPTIONAL_DIR="$TCE_DIR/optional"
ONBOOT_FILE="$TCE_DIR/onboot.lst"
[[ -d "$OPTIONAL_DIR" ]] || fail "Pasta ausente: $OPTIONAL_DIR"
[[ -w "$OPTIONAL_DIR" ]] || fail "Sem permissão de escrita em $OPTIONAL_DIR. Execute o script pela sua conta; use sudo somente se necessário."
[[ -f "$ONBOOT_FILE" ]] || fail "Arquivo ausente: $ONBOOT_FILE"
grep -Fxq 'alsa.tcz' "$ONBOOT_FILE" || fail "onboot.lst não contém alsa.tcz. Corrija a lista antes de instalar as dependências."
grep -Fxq 'SamNatSynth.tcz' "$ONBOOT_FILE" || fail "onboot.lst não contém SamNatSynth.tcz. Corrija a lista antes de instalar as dependências."
[[ -f "$OPTIONAL_DIR/SamNatSynth.tcz" ]] || fail "SamNatSynth.tcz não existe em $OPTIONAL_DIR."
grep -Fxq 'alsa.tcz' "$OPTIONAL_DIR/SamNatSynth.tcz.dep" || fail "A dependência ALSA não aparece em SamNatSynth.tcz.dep."

MODULES_ARCHIVE=$(grep -m1 -oE 'modules-[0-9]+\.[0-9]+\.[0-9]+-piCore-v8\.gz' "$BOOT_MOUNT/config.txt" || true)
[[ -n "$MODULES_ARCHIVE" ]] || fail "Não encontrei em config.txt a versão dos módulos piCore-v8. Confira se esta é a partição boot do piCore64."
KERNEL_VERSION=${MODULES_ARCHIVE#modules-}
KERNEL_VERSION=${KERNEL_VERSION%-piCore-v8.gz}
MODULES_PACKAGE="alsa-modules-${KERNEL_VERSION}-piCore-v8.tcz"
printf 'Kernel detectado: %s-piCore-v8\nMódulo ALSA: %s\n\n' "$KERNEL_VERSION" "$MODULES_PACKAGE"

WORK_DIR=$(mktemp -d /tmp/samnat-picore-alsa.XXXXXX) || fail 'Não consegui criar a pasta temporária em /tmp.'
trap 'rm -rf "$WORK_DIR"' EXIT

FILES=(
	alsa.tcz
	alsa.tcz.dep
	alsa.tcz.md5.txt
	libasound.tcz
	libasound.tcz.dep
	libasound.tcz.md5.txt
	"$MODULES_PACKAGE"
	"$MODULES_PACKAGE.md5.txt"
)

printf '[1/4] Baixando pacotes e metadados do repositório oficial piCore...\n'
for file in "${FILES[@]}"; do
	printf '  - %s\n' "$file"
	if ! curl --fail --location --show-error --silent --retry 3 --connect-timeout 15 \
		"$BASE_URL/$file" -o "$WORK_DIR/$file"; then
		fail "Falha ao baixar $BASE_URL/$file. Verifique a conexão com a internet; nada foi copiado ao pendrive."
	fi
done

grep -Fxq 'libasound.tcz' "$WORK_DIR/alsa.tcz.dep" || fail 'O metadado baixado de alsa.tcz não aponta para libasound.tcz.'
grep -Fxq 'alsa-modules-KERNEL.tcz' "$WORK_DIR/libasound.tcz.dep" || fail 'O metadado baixado de libasound.tcz não aponta para alsa-modules-KERNEL.tcz.'

printf '\n[2/4] Conferindo checksums antes de gravar...\n'
if ! (cd "$WORK_DIR" && md5sum -c \
	alsa.tcz.md5.txt \
	libasound.tcz.md5.txt \
	"$MODULES_PACKAGE.md5.txt"); then
	fail 'Um ou mais checksums não conferem. Nada foi copiado ao pendrive.'
fi

for file in "${FILES[@]}"; do
	if [[ -e "$OPTIONAL_DIR/$file" ]] && ! cmp -s "$WORK_DIR/$file" "$OPTIONAL_DIR/$file"; then
		fail "Já existe uma versão diferente de $file em $OPTIONAL_DIR; não sobrescrevi o arquivo."
	fi
done

printf '\n[3/4] Copiando extensões para a partição TCE...\n'
for file in "${FILES[@]}"; do
	if [[ -e "$OPTIONAL_DIR/$file" ]]; then
		printf '  Já está atualizado: %s\n' "$file"
	else
		printf '  Gravando: %s\n' "$file"
		if ! install -m 0644 "$WORK_DIR/$file" "$OPTIONAL_DIR/$file"; then
			fail "Não consegui gravar $OPTIONAL_DIR/$file. Confira espaço e permissões; o log mostra o que já foi copiado."
		fi
	fi
done

printf '\n[4/4] Sincronizando e validando os arquivos no pendrive...\n'
sync || fail 'O comando sync falhou; aguarde e confira o pendrive antes de removê-lo.'
if ! (cd "$OPTIONAL_DIR" && md5sum -c \
	alsa.tcz.md5.txt \
	libasound.tcz.md5.txt \
	"$MODULES_PACKAGE.md5.txt"); then
	fail 'A validação após a cópia falhou. Não remova o pendrive até conferir o log.'
fi

printf '\nCONCLUÍDO: dependências ALSA copiadas e verificadas.\n'
printf 'Destino: %s\n' "$OPTIONAL_DIR"
printf 'Inicialização: %s\n' "$ONBOOT_FILE"
printf 'Log: %s\n' "$LOG_FILE"
printf 'Agora ejete o pendrive com segurança antes de conectá-lo ao Raspberry Pi.\n'
