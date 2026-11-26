#!/usr/bin/env bash
set -euo pipefail

RASPICORE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$RASPICORE_DIR/.." && pwd)
export SAMNAT_APPDIR=${SAMNAT_APPDIR:-$RASPICORE_DIR/build/SamNatSynthARM64.AppDir}
export SAMNAT_RPI_ARM64_WORK=${SAMNAT_RPI_ARM64_WORK:-$PROJECT_ROOT/.cache/picore-arm64-work}
export SAMNAT_RPI_ARM64_CONTAINER=${SAMNAT_RPI_ARM64_CONTAINER:-samnat-picore-arm64-builder}
APPDIR=$SAMNAT_APPDIR

# Seed this isolated builder's archive cache with complete Debian packages
# already downloaded by the separate Raspberry Buildroot builder.
SOURCE_DEB_CACHE="$PROJECT_ROOT/.cache/rpi3-arm64-work/apt-cache/archives"
TARGET_DEB_CACHE="$SAMNAT_RPI_ARM64_WORK/apt-cache/archives"
mkdir -p "$TARGET_DEB_CACHE"
if [[ -d "$SOURCE_DEB_CACHE" ]]; then
	find "$SOURCE_DEB_CACHE" -maxdepth 1 -type f -name '*.deb' -exec cp -n -t "$TARGET_DEB_CACHE" -- {} +
fi

if [[ ! -x "$APPDIR/AppRun" || ! -x "$APPDIR/qode" ]]; then
	"$PROJECT_ROOT/raspberry/build-appdir-rpi3.sh"
fi

"$RASPICORE_DIR/package-picore-tcz.sh"
