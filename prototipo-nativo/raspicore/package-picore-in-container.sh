#!/bin/sh
set -eu

APPDIR=${1:?AppDir path required}
ROOTFS=${2:?Output rootfs staging path required}
APP="$ROOTFS/opt/samnat-synth"

mkdir -p "$APP/bin" "$APP/lib/audio" "$APP/share/alsa" "$APP/share/fonts/truetype/dejavu"
cp -a "$APPDIR/." "$APP/"
for command in fluidsynth aplay amixer aseqdump; do
	command_path=$(command -v "$command" || true)
	if [ -z "$command_path" ]; then
		echo "Comando obrigatório '$command' ausente no container; instale os pacotes fluidsynth e alsa-utils." >&2
		exit 1
	fi
	cp -p "$command_path" "$APP/bin/$command"
done

copy_runtime_dependencies() {
	binary=$1
	ldd "$binary" 2>/dev/null | while IFS= read -r line; do
		dependency=$(printf '%s\n' "$line" | sed -nE 's/.*=> ([^ ]+).*/\1/p; s/^[[:space:]]*(\/[^ ]+)[[:space:]]+\(.*/\1/p')
		[ -n "$dependency" ] && [ -f "$dependency" ] || continue
		name=${dependency##*/}
		case "$name" in
			libc.so.*|libm.so.*|libpthread.so.*|libdl.so.*|librt.so.*|libresolv.so.*|libutil.so.*|libanl.so.*|libnss_*.so.*|ld-linux-aarch64.so.*) continue ;;
		esac
		[ -e "$APP/lib/audio/$name" ] || cp -aL "$dependency" "$APP/lib/audio/$name"
	done
}

for binary in "$APP/bin/fluidsynth" "$APP/bin/aplay" "$APP/bin/amixer" "$APP/bin/aseqdump" \
	"$APP/qode" "$APP/dist/node_modules/@nodegui/nodegui/build/Release/nodegui_core.node" \
	"$APP/dist/node_modules/midi/build/Release/midi.node" \
	"$APP/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_arm64/plugins/platforms/libqlinuxfb.so"; do
	[ ! -f "$binary" ] || copy_runtime_dependencies "$binary"
done

cp -a /usr/share/alsa/. "$APP/share/alsa/"
cp -a /usr/share/fonts/truetype/dejavu/. "$APP/share/fonts/truetype/dejavu/"
if [ ! -d /usr/share/X11/xkb ]; then
	echo 'Dados XKB ausentes no container ARM64.' >&2
	exit 1
fi
mkdir -p "$APP/share/X11" "$APP/share/fontconfig"
cp -a /usr/share/X11/xkb "$APP/share/X11/"
cat > "$APP/share/fontconfig/fonts.conf" <<'FONTCONFIG'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>/opt/samnat-synth/share/fonts/truetype/dejavu</dir>
  <cachedir>/tmp/samnat-fontconfig-cache</cachedir>
</fontconfig>
FONTCONFIG
