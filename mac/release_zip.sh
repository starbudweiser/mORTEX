#!/bin/bash
# mORTEX : prépare les fichiers à déposer dans une release GitHub pour la mise à jour automatique :
#   mORTEX-<version>-mac-arm64.zip  (l'appli signée, archive ditto) et son .sha256.
# Usage : mac/release_zip.sh [chemin/mORTEX.app]   (par défaut : mORTEX.app à la racine du dépôt)
# Rien n'est publié : le dépôt de la release sur GitHub reste une décision de l'auteur.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$APP_DIR/mORTEX.app}"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
OUT="$APP_DIR/dist/release"
mkdir -p "$OUT"
ZIP="$OUT/mORTEX-$VERSION-mac-arm64.zip"
codesign --verify --deep --strict "$APP"
rm -f "$ZIP" "$ZIP.sha256"
ditto -ck --keepParent "$APP" "$ZIP"
(cd "$OUT" && shasum -a 256 "$(basename "$ZIP")" > "$(basename "$ZIP").sha256")
echo "$ZIP"
cat "$ZIP.sha256"
