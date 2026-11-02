#!/usr/bin/env bash
# Regenerates apps/webapp/public/og-image.png from scripts/og-image/og.html using headless Chrome.
# app-screenshot.png next to it is a 1280x800 capture of the app in dark mode.
# Set CHROME to override the browser binary.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=4000 \
  --screenshot="$PWD/apps/webapp/public/og-image.png" "file://$PWD/scripts/og-image/og.html" 2>/dev/null
echo "==> Wrote apps/webapp/public/og-image.png"
