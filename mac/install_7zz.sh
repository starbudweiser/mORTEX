#!/bin/bash
# mORTEX : 7z-bin n'a pas de binaire darwin ; node-7z lance <7z-bin>/darwin/7z.
# Copie mac/vendor/7zip/7zz (7-Zip officiel arm64, gère .7z/.zip/.rar) dans chaque dossier 7z-bin donné.
# Usage : mac/install_7zz.sh <dossier-7z-bin>…   (sans argument : copies du magasin pnpm, pour le dev)
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIRS=("$@")
if [ ${#DIRS[@]} -eq 0 ]; then
  while IFS= read -r d; do DIRS+=("$d"); done < <(ls -d "$APP_DIR"/node_modules/.pnpm/7z-bin@*/node_modules/7z-bin)
fi
for D in "${DIRS[@]}"; do
  mkdir -p "$D/darwin" && cp "$APP_DIR/mac/vendor/7zip/7zz" "$D/darwin/7z" && chmod 755 "$D/darwin/7z"
  echo "7z : $D/darwin/7z"
done
