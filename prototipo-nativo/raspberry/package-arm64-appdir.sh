#!/bin/bash
set -euo pipefail

# Package the native ARM64 runtime after install-pi-os.sh has built Qode,
# NodeGui, and MIDI. This also runs in an ARM64 container emulated on Ubuntu.

APP_SOURCE=${1:-}
APP_ROOT=${2:-/opt/samnat-synth}
APPDIR=${3:-$APP_ROOT/build/SamNatSynthARM64.AppDir}

if [[ $(uname -m) != aarch64 && ${SAMNAT_ALLOW_EMULATED_ARM64:-0} != 1 ]]; then
	echo "Run in an ARM64 Linux environment (native or emulated); found $(uname -m)." >&2
	exit 1
fi
if [[ -z "$APP_SOURCE" || ! -f "$APP_SOURCE/package.json" ]]; then
	echo "Pass the prototipo-nativo source directory." >&2
	exit 1
fi
APP_SOURCE=$(CDPATH= cd -- "$APP_SOURCE" && pwd)
QODE_BIN="$APP_ROOT/node_modules/@nodegui/qode/binaries/qode"
NODEGUI_ADDON="$APP_ROOT/node_modules/@nodegui/nodegui/build/Release/nodegui_core.node"
MIDI_ADDON="$APP_ROOT/node_modules/midi/build/Release/midi.node"
QT_MULTIARCH="$(dpkg-architecture -qDEB_HOST_MULTIARCH)"
QT_PLUGIN_ROOT="/usr/lib/$QT_MULTIARCH/qt6/plugins"
QT_HOME="$APPDIR/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_arm64"

for native_file in "$QODE_BIN" "$NODEGUI_ADDON" "$MIDI_ADDON"; do
	if [[ ! -f "$native_file" ]] || ! file "$native_file" | grep -q 'ARM aarch64'; then
		echo "Missing or non-AArch64 native module: $native_file" >&2
		exit 1
	fi
done
if [[ ! -f "$QT_PLUGIN_ROOT/platforms/libqlinuxfb.so" ]]; then
	echo "Qt LinuxFB plugin is missing: $QT_PLUGIN_ROOT/platforms/libqlinuxfb.so" >&2
	exit 1
fi

mkdir -p "$APPDIR/dist" "$QT_HOME/lib" "$QT_HOME/plugins" "$APPDIR/lib/audio"
for file in index.js audio-worker.cjs soundfont-catalog.json; do
	cp -p "$APP_SOURCE/src/$file" "$APPDIR/dist/$file"
done
cp -a "$APP_SOURCE/src/icons" "$APPDIR/dist/icons"
cp -p "$APP_SOURCE/deploy/linux/SamnatSynthNative/default.png" "$APPDIR/dist/samnat-logo.png"
cp -a "$APP_ROOT/node_modules/." "$APPDIR/dist/node_modules/"
cp -p "$QODE_BIN" "$APPDIR/qode"
cp -a "$APP_SOURCE/deploy/linux/SamnatSynthNative/." "$APPDIR/"

# Install the distribution's Qt 6 shared libraries and the framebuffer, SVG,
# and image plugins into the same compact layout used by the x86 AppDir.
cp -aL /usr/lib/"$QT_MULTIARCH"/libQt6*.so* "$QT_HOME/lib/"
for plugin_group in platforms generic imageformats iconengines; do
	if [[ -d "$QT_PLUGIN_ROOT/$plugin_group" ]]; then
		mkdir -p "$QT_HOME/plugins/$plugin_group"
		cp -aL "$QT_PLUGIN_ROOT/$plugin_group/." "$QT_HOME/plugins/$plugin_group/"
	fi
done

copy_external_dependencies() {
	local binary=$1 line dependency name destination
	while IFS= read -r line; do
		dependency=$(sed -nE 's/.*=> ([^ ]+).*/\1/p; s/^[[:space:]]*(\/[^ ]+)[[:space:]]+\(.*/\1/p' <<< "$line")
		[[ -n "$dependency" && -f "$dependency" ]] || continue
		name=${dependency##*/}
		case "$name" in
			libc.so.*|libm.so.*|libpthread.so.*|libdl.so.*|librt.so.*|libresolv.so.*|libutil.so.*|libanl.so.*|libnss_*.so.*|ld-linux-aarch64.so.*|libasound.so.*)
				continue
				;;
		esac
		destination="$APPDIR/lib/audio/$name"
		[[ -e "$destination" ]] || cp -aL "$dependency" "$destination"
	done < <(ldd "$binary" 2>/dev/null || true)
}

for binary in \
	"$QODE_BIN" "$NODEGUI_ADDON" "$MIDI_ADDON" \
	"$QT_PLUGIN_ROOT/platforms/libqlinuxfb.so" \
	"$QT_PLUGIN_ROOT/imageformats/libqsvg.so" \
	"$QT_PLUGIN_ROOT/iconengines/libqsvgicon.so"; do
	[[ -f "$binary" ]] && copy_external_dependencies "$binary"
done
for qtlib in "$QT_HOME"/lib/libQt6*.so*; do
	[[ -f "$qtlib" ]] && copy_external_dependencies "$qtlib"
done

cat > "$APPDIR/AppRun" <<'APPRUN'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
QT_HOME="$HERE/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_arm64"
export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib/audio:$HERE/lib:${LD_LIBRARY_PATH:-}"
export PATH="$HERE/bin:${PATH:-/usr/bin:/bin}"
export QT_PLUGIN_PATH="$QT_HOME/plugins"
export QT_QPA_PLATFORM_PLUGIN_PATH="$QT_HOME/plugins/platforms"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-linuxfb}"
export SAMNAT_AUDIO_LIB_DIR="$HERE/lib/audio"
cd "$HERE"
exec "$HERE/qode" "$HERE/dist/index.js" "$@"
APPRUN
chmod 0755 "$APPDIR/AppRun" "$APPDIR/qode"

echo "ARM64 AppDir packaged at $APPDIR"
