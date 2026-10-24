#!/bin/bash
# mORTEX : FOMOD XML natif sur macOS arm64 (étape 3).
#  1. compile fomod-installer (amont, NativeAOT osx-arm64) en ModInstaller.Native.dylib ;
#  2. compile l'addon N-API (modinstaller.node) contre cette dylib avec mac/fomod/binding.darwin.gyp,
#     dans chaque copie du paquet @nexusmods/fomod-installer-native passée en argument.
# Usage : mac/fomod_native.sh <dossier-du-paquet>…   (sans argument : copie du magasin pnpm, pour le dev)
# Le runtime .NET n'est pas requis à l'exécution (NativeAOT autonome). Journaux : logs/fomod_*.log.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$APP_DIR/mac/env.sh"
VERSION=0.13.4
SRC="$APP_DIR/mac/native/fomod-installer"
OUT="$APP_DIR/mac/native/out"
mkdir -p "$APP_DIR/logs" "$OUT"

if [ ! -f "$OUT/ModInstaller.Native.dylib" ]; then
  [ -d "$SRC" ] || git clone --depth 1 --branch "v$VERSION" https://github.com/Nexus-Mods/fomod-installer.git "$SRC" \
    2>/dev/null || git clone --depth 1 https://github.com/Nexus-Mods/fomod-installer.git "$SRC"
  # global.json impose le SDK 9 ; le SDK 10 sait compiler net9.0. Le csproj ne prévoit que win-x64/linux-x64.
  rm -f "$SRC/global.json"
  PROJ="$SRC/src/ModInstaller.Native/ModInstaller.Native.csproj"
  if ! grep -q osx-arm64 "$PROJ"; then
    sed -i '' 's#<RuntimeIdentifier>linux-x64</RuntimeIdentifier>#<RuntimeIdentifier>osx-arm64</RuntimeIdentifier>#' "$PROJ"
  fi
  (cd "$SRC/src/ModInstaller.Native" && dotnet publish -c Release -r osx-arm64) > "$APP_DIR/logs/fomod_aot.log" 2>&1 \
    || { tail -20 "$APP_DIR/logs/fomod_aot.log"; exit 1; }
  cp "$SRC/src/ModInstaller.Native/bin/Release/net9.0/osx-arm64/publish/ModInstaller.Native.dylib" "$OUT/"
  install_name_tool -id @rpath/ModInstaller.Native.dylib "$OUT/ModInstaller.Native.dylib"
fi

PKGS=("$@")
if [ ${#PKGS[@]} -eq 0 ]; then
  PKGS=("$(ls -d "$APP_DIR"/node_modules/.pnpm/@nexusmods+fomod-installer-native@*/node_modules/@nexusmods/fomod-installer-native | head -1)")
fi
for PKG in "${PKGS[@]}"; do
  echo "addon N-API : $PKG"
  cp "$OUT/ModInstaller.Native.dylib" "$PKG/"
  cp "$APP_DIR/mac/fomod/binding.darwin.gyp" "$PKG/binding.gyp"
  (cd "$PKG" && rm -rf build && pnpm dlx node-gyp rebuild) > "$APP_DIR/logs/fomod_addon.log" 2>&1 \
    || { tail -20 "$APP_DIR/logs/fomod_addon.log"; exit 1; }
done
