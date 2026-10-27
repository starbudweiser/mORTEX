#!/bin/bash
# mORTEX : compile l'extension App Intents (Raccourcis, Siri, Spotlight) sans projet Xcode,
# comme le fait Xcode : swiftc avec extraction des constantes, puis appintentsmetadataprocessor
# pour Metadata.appintents. Usage : build_intents.sh <dossier de sortie>  →  <sortie>/MortexIntents.appex
set -euo pipefail
SRC="$(cd "$(dirname "$0")/MortexIntents" && pwd)"
OUT="${1:?Usage : build_intents.sh <dossier de sortie>}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SDK="$(xcrun --show-sdk-path)"
TRIPLE="arm64-apple-macos14.0"
TOOLCHAIN="$(dirname "$(dirname "$(dirname "$(xcrun --find swiftc)")")")"
XCODE_BUILD="$(xcodebuild -version | awk '/Build version/ {print $3}')"
APPEX="$OUT/MortexIntents.appex"

# protocoles dont Xcode extrait les constantes pour App Intents
cat > "$WORK/protocols.json" <<'JSON'
["AppIntent", "EntityQuery", "AppEntity", "TransientEntity", "AppEnum", "AppShortcutsProvider",
 "AppIntentsPackage", "DynamicOptionsProvider", "AppShortcutProviding", "_IntentValueRepresentable",
 "_AssistantIntentsProvider", "_GenerativeFunctionExtractable", "AppIntentsExtension"]
JSON

rm -rf "$APPEX"
mkdir -p "$APPEX/Contents/MacOS" "$APPEX/Contents/Resources"
# en objet d'abord (module entier) : c'est ce mode qui produit le fichier des constantes
swiftc -module-name MortexIntents -parse-as-library -O -wmo -c \
  -target "$TRIPLE" -sdk "$SDK" \
  -emit-const-values-path "$WORK/Intents.swiftconstvalues" \
  -Xfrontend -const-gather-protocols-file -Xfrontend "$WORK/protocols.json" \
  "$SRC/Intents.swift" -o "$WORK/Intents.o"
swiftc -target "$TRIPLE" -sdk "$SDK" "$WORK/Intents.o" -o "$APPEX/Contents/MacOS/MortexIntents"

echo "$SRC/Intents.swift" > "$WORK/sources.txt"
echo "$WORK/Intents.swiftconstvalues" > "$WORK/constvalues.txt"
xcrun appintentsmetadataprocessor --output "$APPEX/Contents/Resources" \
  --toolchain-dir "$TOOLCHAIN" --module-name MortexIntents --sdk-root "$SDK" \
  --xcode-version "$XCODE_BUILD" --platform-family macOS --deployment-target 14.0 \
  --target-triple "$TRIPLE" --source-file-list "$WORK/sources.txt" \
  --swift-const-vals-list "$WORK/constvalues.txt" --force

cp "$SRC/Info.plist" "$APPEX/Contents/Info.plist"
for lproj in "$SRC"/*.lproj; do
  [ -d "$lproj" ] && cp -R "$lproj" "$APPEX/Contents/Resources/"
done
echo "OK : $APPEX"
