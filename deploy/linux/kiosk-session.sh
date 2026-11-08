#!/bin/sh
set -eu

# Keep the display awake while the synth is running.
xset s off
xset -dpms
xset s noblank

exec /opt/samnat-synth/samnat-synth
