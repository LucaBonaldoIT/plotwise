#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm ci
fi

npm run webapp:build

echo
echo "Static site ready: apps/webapp/dist"
