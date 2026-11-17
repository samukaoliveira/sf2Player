#!/bin/sh
set -eu

usage() {
	echo "Uso: $0 /ponto/de/montagem/da/particao-raiz-do-samnat" >&2
	exit 2
}

[ "$#" -eq 1 ] || usage
[ -d "$1/etc" ] || {
	echo "Erro: '$1' não parece ser a partição raiz do SamNat." >&2
	exit 1
}

ROOT=$(CDPATH= cd -- "$1" && pwd -P)
APP_SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
SESSION="$ROOT/usr/local/bin/samnat-session"
INITTAB="$ROOT/etc/inittab"
APPRUN="$ROOT/opt/samnat-synth/AppRun"
PLUGIN_SOURCE="$APP_SOURCE/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_64/plugins/platforms/libqlinuxfb.so"
PLUGIN_DIR="$ROOT/opt/samnat-synth/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_64/plugins/platforms"
APP_LIB_DIR="$ROOT/opt/samnat-synth/lib/audio"
GLX_SOURCE=/usr/lib/x86_64-linux-gnu/libGLX.so.0
GLDISPATCH_SOURCE=/usr/lib/x86_64-linux-gnu/libGLdispatch.so.0
OPENGL_SOURCE=/usr/lib/x86_64-linux-gnu/libOpenGL.so.0
GTHREAD_SOURCE=/usr/lib/x86_64-linux-gnu/libgthread-2.0.so.0
FONT_SOURCE_DIR=/usr/share/fonts/truetype/dejavu
FONT_DIR="$ROOT/usr/share/fonts/truetype/dejavu"

[ -f "$INITTAB" ] || { echo "Erro: $INITTAB não encontrado." >&2; exit 1; }
[ -f "$SESSION" ] || { echo "Erro: $SESSION não encontrado." >&2; exit 1; }
[ -x "$ROOT/opt/samnat-synth/AppRun" ] || { echo "Erro: AppRun do SamNat não encontrado." >&2; exit 1; }
[ -f "$ROOT/opt/samnat-synth/lib/audio/libglib-2.0.so.0" ] || { echo "Erro: libglib-2.0.so.0 não encontrado no AppDir." >&2; exit 1; }
[ -f "$PLUGIN_SOURCE" ] || { echo "Erro: plugin Qt LinuxFB não encontrado em $PLUGIN_SOURCE." >&2; exit 1; }
[ -r "$GLX_SOURCE" ] || { echo "Erro: libGLX.so.0 não encontrada em $GLX_SOURCE." >&2; exit 1; }
[ -r "$GLDISPATCH_SOURCE" ] || { echo "Erro: libGLdispatch.so.0 não encontrada em $GLDISPATCH_SOURCE." >&2; exit 1; }
[ -r "$OPENGL_SOURCE" ] || { echo "Erro: libOpenGL.so.0 não encontrada em $OPENGL_SOURCE." >&2; exit 1; }
[ -r "$GTHREAD_SOURCE" ] || { echo "Erro: libgthread-2.0.so.0 não encontrada em $GTHREAD_SOURCE." >&2; exit 1; }
[ -r "$FONT_SOURCE_DIR/DejaVuSans.ttf" ] || { echo "Erro: fonte DejaVu Sans não encontrada em $FONT_SOURCE_DIR." >&2; exit 1; }
grep -q '^export QT_QPA_PLATFORM=xcb$\|^export QT_QPA_PLATFORM=linuxfb$' "$SESSION" || {
	echo "Erro: não encontrei a configuração QT_QPA_PLATFORM esperada em $SESSION." >&2
	exit 1
}
grep -q '^tty1::respawn:/usr/local/bin/samnat-start-x$\|^tty1::respawn:/usr/local/bin/samnat-session$' "$INITTAB" || {
	echo "Erro: não encontrei a entrada de inicialização do tty1 esperada em $INITTAB." >&2
	exit 1
}
grep -Fq 'export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib:${LD_LIBRARY_PATH:-}"' "$APPRUN" ||
	grep -Fq 'export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib/audio:$HERE/lib:${LD_LIBRARY_PATH:-}"' "$APPRUN" || {
		echo "Erro: não encontrei a configuração LD_LIBRARY_PATH esperada em $APPRUN." >&2
		exit 1
	}

[ -e "$SESSION.pre-linuxfb" ] || cp -p "$SESSION" "$SESSION.pre-linuxfb"
[ -e "$INITTAB.pre-linuxfb" ] || cp -p "$INITTAB" "$INITTAB.pre-linuxfb"
[ -e "$APPRUN.pre-linuxfb" ] || cp -p "$APPRUN" "$APPRUN.pre-linuxfb"

mkdir -p "$PLUGIN_DIR"
mkdir -p "$FONT_DIR"
install -m 0644 "$PLUGIN_SOURCE" "$PLUGIN_DIR/libqlinuxfb.so"
install -m 0644 "$GLX_SOURCE" "$APP_LIB_DIR/libGLX.so.0"
install -m 0644 "$GLDISPATCH_SOURCE" "$APP_LIB_DIR/libGLdispatch.so.0"
install -m 0644 "$OPENGL_SOURCE" "$APP_LIB_DIR/libOpenGL.so.0"
install -m 0644 "$GTHREAD_SOURCE" "$APP_LIB_DIR/libgthread-2.0.so.0"
for font in DejaVuSans.ttf DejaVuSans-Bold.ttf DejaVuSansMono.ttf DejaVuSansMono-Bold.ttf DejaVuSerif.ttf DejaVuSerif-Bold.ttf; do
	if [ -r "$FONT_SOURCE_DIR/$font" ]; then
		install -m 0644 "$FONT_SOURCE_DIR/$font" "$FONT_DIR/$font"
	fi
done
sed -i 's/^export QT_QPA_PLATFORM=xcb$/export QT_QPA_PLATFORM=linuxfb/' "$SESSION"
if grep -q '^export QT_QPA_FONTDIR=' "$SESSION"; then
	sed -i 's|^export QT_QPA_FONTDIR=.*$|export QT_QPA_FONTDIR=/usr/share/fonts/truetype/dejavu|' "$SESSION"
else
	sed -i '/^export QT_QPA_PLATFORM=linuxfb$/a export QT_QPA_FONTDIR=/usr/share/fonts/truetype/dejavu' "$SESSION"
fi
sed -i 's|^tty1::respawn:/usr/local/bin/samnat-start-x$|tty1::respawn:/usr/local/bin/samnat-session|' "$INITTAB"
sed -i 's|^export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib:${LD_LIBRARY_PATH:-}"$|export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib/audio:$HERE/lib:${LD_LIBRARY_PATH:-}"|' "$APPRUN"

sync
echo "Ajuste aplicado em $ROOT. O SamNat iniciará diretamente no framebuffer Linux (linuxfb), sem Xorg."
echo "Fontes DejaVu instaladas em $FONT_DIR para corrigir caracteres quadrados."
echo "O LinuxFB já recebe eventos evdev; o mouse só funciona se o kernel criar /dev/input/event* para o dispositivo."
echo "Backups: $SESSION.pre-linuxfb, $INITTAB.pre-linuxfb e $APPRUN.pre-linuxfb"
