#!/bin/sh
# Copies the extension into Spicetify, enables it and applies it to Spotify (macOS / Linux).
# Run: sh install.sh
set -e

if ! command -v spicetify >/dev/null 2>&1; then
  echo "Spicetify not found. Install it: https://spicetify.app"
  exit 1
fi

USERDATA="$(spicetify path userdata 2>/dev/null | tail -n 1)"
[ -d "$USERDATA" ] || USERDATA="$HOME/.config/spicetify"

mkdir -p "$USERDATA/Extensions"
cp "$(dirname "$0")/src/glass-lyrics.js" "$USERDATA/Extensions/"
echo "Copied to $USERDATA/Extensions"

spicetify config extensions glass-lyrics.js
spicetify apply
