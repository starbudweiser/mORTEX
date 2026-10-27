#!/bin/bash
# mORTEX : compile l'extension Quick Look (aperçu des .dds et des plugins .esp/.esm/.esl).
# Usage : build_quicklook.sh <dossier de sortie>  →  <sortie>/MortexQuickLook.appex (à mettre dans Contents/PlugIns)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/MortexQuickLook" && pwd)"
OUT="${1:?Usage : build_quicklook.sh <dossier de sortie>}"
APPEX="$OUT/MortexQuickLook.appex"
rm -rf "$APPEX"
mkdir -p "$APPEX/Contents/MacOS" "$APPEX/Contents/Resources"
# extension NSExtension : point d'entrée _NSExtensionMain, classe principale MortexQuickLook.PreviewProvider
swiftc -module-name MortexQuickLook -parse-as-library -O \
  -target arm64-apple-macos14.0 -sdk "$(xcrun --show-sdk-path)" \
  -Xlinker -e -Xlinker _NSExtensionMain -framework QuickLookUI \
  "$SRC/PreviewProvider.swift" -o "$APPEX/Contents/MacOS/MortexQuickLook"
cp "$SRC/Info.plist" "$APPEX/Contents/Info.plist"
for lproj in "$SRC"/*.lproj; do cp -R "$lproj" "$APPEX/Contents/Resources/"; done
echo "OK : $APPEX"
