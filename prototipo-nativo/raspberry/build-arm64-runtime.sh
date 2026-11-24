#!/bin/sh
set -eu

# Build only the ARM64 application runtime. The shared build logic lives in
# install-pi-os.sh; this mode skips apt/systemd/boot changes and creates AppDir.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export SAMNAT_BUILD_ONLY=1
exec "$SCRIPT_DIR/install-pi-os.sh" "$@"
