#!/bin/bash
# mORTEX : construit mORTEX.app (arm64, non signé par electron-builder), le signe avec
# le certificat local stable (_tools/sign_app.sh) et le dépose dans mORTEX.app (racine) puis dans ~/Applications/Skyrim Tools.
# Usage : mac/package.sh   (SKIP_BUILD=1 pour sauter build/lint/typecheck)
# Prérequis : mac/rebuild.sh déjà lancé une fois.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$APP_DIR/mac/env.sh"
cd "$APP_DIR"
export NODE_ENV=production
[ "${SKIP_BUILD:-0}" = 1 ] || pnpm run build
cd src/main
pnpm nx run @vortex/main:publish
cd dist
# 7zz et FOMOD natif (étape 3) : absents des paquets amont pour darwin
"$APP_DIR/mac/install_7zz.sh" "$PWD/node_modules/7z-bin"
"$APP_DIR/mac/fomod_native.sh" "$PWD/node_modules/@nexusmods/fomod-installer-native"
# electron-builder appelé directement : « pnpm exec » relancerait pnpm install dans dist.
"$APP_DIR/src/main/node_modules/.bin/electron-builder" \
  --config ./electron-builder.config.json --mac dir --arm64 --publish never \
  -c.productName=mORTEX -c.appId=fr.stephan.mortex \
  -c.mac.icon="$APP_DIR/mac/assets/mORTEX.icns" -c.mac.category=public.app-category.utilities \
  -c.mac.identity=null -c.directories.output="$APP_DIR/dist"
OUT="$APP_DIR/dist/mac-arm64/mORTEX.app"
rm -rf "$APP_DIR/mORTEX.app" && cp -R "$OUT" "$APP_DIR/mORTEX.app"
# Schéma nxm:// (« Mod Manager Download » de Nexus) : déclaré dans l'Info.plist
PL="$APP_DIR/mORTEX.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" \
  -c "Add :CFBundleURLTypes:0 dict" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLName string fr.stephan.mortex.nxm" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string nxm" "$PL"
# Schéma mortex:// : actions des Raccourcis (extension App Intents ci-dessous)
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:1 dict" \
  -c "Add :CFBundleURLTypes:1:CFBundleURLName string fr.stephan.mortex.actions" \
  -c "Add :CFBundleURLTypes:1:CFBundleURLSchemes array" \
  -c "Add :CFBundleURLTypes:1:CFBundleURLSchemes:0 string mortex" "$PL"
# Extensions natives (Swift) : Raccourcis/Siri/Spotlight, dans Contents/Extensions (ExtensionKit)
EXT_DIR="$APP_DIR/mORTEX.app/Contents/Extensions"
mkdir -p "$EXT_DIR"
"$APP_DIR/mac/swift/build_intents.sh" "$EXT_DIR"
/Volumes/SKYRIM/TOOLS/MAC/_tools/sign_app.sh "$APP_DIR/mORTEX.app"
# sign_app.sh signe en profondeur avec l'identifiant de l'appli : chaque extension reprend le sien
# et ses droits (bac à sable obligatoire), puis l'appli est rescellée sans --deep.
SIGN_HASH="$(security find-identity -v -p codesigning | grep '"sKYCRASH Local Signing"' | awk '{print $2}' | head -1)"
for APPEX in "$EXT_DIR"/*.appex; do
  NAME="$(basename "$APPEX" .appex)"
  codesign --force --sign "${SIGN_HASH:--}" \
    --identifier "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APPEX/Contents/Info.plist")" \
    --entitlements "$APP_DIR/mac/swift/$NAME/Entitlements.plist" "$APPEX"
done
codesign --force --sign "${SIGN_HASH:--}" --identifier fr.stephan.mortex \
  --preserve-metadata=entitlements,requirements,flags,runtime "$APP_DIR/mORTEX.app"
codesign --verify --deep --strict "$APP_DIR/mORTEX.app"
# Lancé seul : installe dans ~/Applications/Skyrim Tools (build_all.sh, qui pose NO_OPEN, s'en charge lui-même).
if [ -z "${NO_OPEN:-}" ]; then
  DEST="${SKYRIM_APPS_DIR:-$HOME/Applications/Skyrim Tools}"
  mkdir -p "$DEST" && rm -rf "$DEST/mORTEX.app" && mv "$APP_DIR/mORTEX.app" "$DEST/mORTEX.app"
  echo "OK : $DEST/mORTEX.app"
fi
