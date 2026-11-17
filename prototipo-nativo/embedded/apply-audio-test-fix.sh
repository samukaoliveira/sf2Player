#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
	echo "Uso: $0 DIRETORIO_RAIZ_MONTADO_DO_SAMNAT" >&2
	exit 2
fi

TARGET_DIR=$(realpath "$1")
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIST="$TARGET_DIR/opt/samnat-synth/dist"
SESSION="$TARGET_DIR/usr/local/bin/samnat-session"
UNMUTE_SOURCE="$SCRIPT_DIR/board/samnat/rootfs-overlay/usr/local/bin/samnat-audio-init"

if [ ! -f "$TARGET_DIR/opt/samnat-synth/AppRun" ] || [ ! -f "$APP_DIST/index.js" ] || [ ! -f "$APP_DIST/audio-worker.cjs" ] || [ ! -f "$SESSION" ]; then
	echo "Erro: '$TARGET_DIR' não parece ser a raiz do SamNat com o app instalado." >&2
	exit 1
fi
if [ ! -f "$UNMUTE_SOURCE" ]; then
	echo "Erro: script para inicializar o mixer ausente: '$UNMUTE_SOURCE'." >&2
	exit 1
fi

for FILE in index.js audio-worker.cjs; do
	if [ ! -f "$SCRIPT_DIR/../src/$FILE" ]; then
		echo "Erro: fonte ausente: '$SCRIPT_DIR/../src/$FILE'." >&2
		exit 1
	fi
	if [ ! -e "$APP_DIST/$FILE.samnat-backup" ]; then
		cp -p "$APP_DIST/$FILE" "$APP_DIST/$FILE.samnat-backup"
	fi
	install -m 0644 "$SCRIPT_DIR/../src/$FILE" "$APP_DIST/$FILE"
done

if [ ! -e "$SESSION.pre-audio-init" ]; then
	cp -p "$SESSION" "$SESSION.pre-audio-init"
fi
if ! grep -Fq '/usr/local/bin/samnat-audio-init' "$SESSION"; then
	grep -Fq 'exec /opt/samnat-synth/AppRun' "$SESSION" || {
		echo "Erro: não encontrei a linha de inicialização do app em '$SESSION'." >&2
		exit 1
	}
	sed -i '\|exec /opt/samnat-synth/AppRun|i /usr/local/bin/samnat-audio-init || true' "$SESSION"
fi
install -m 0755 "$UNMUTE_SOURCE" "$TARGET_DIR/usr/local/bin/samnat-audio-init"

sync
echo "Ajuste ALSA aplicado em '$TARGET_DIR': teste libera o dispositivo, mixer ALC257 inicia sem mute e salva diagnóstico em /data/home/.samnat-synth/audio-hw.log. Sem recompilar a imagem; backups .samnat-backup e .pre-audio-init foram preservados."
