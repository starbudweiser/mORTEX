#!/bin/bash
# mORTEX : construit mORTEX.app (arm64, non signé par electron-builder), le signe avec
# le certificat local stable (_tools/sign_app.sh) et le dépose dans ../mORTEX.app.
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
# electron-builder appelé directement : « pnpm exec » relancerait pnpm install dans dist.
"$APP_DIR/src/main/node_modules/.bin/electron-builder" \
  --config ./electron-builder.config.json --mac dir --arm64 --publish never \
  -c.productName=mORTEX -c.appId=fr.stephan.mortex \
  -c.mac.icon="$APP_DIR/mac/assets/mORTEX.icns" -c.mac.category=public.app-category.utilities \
  -c.mac.identity=null -c.directories.output="$APP_DIR/../dist"
OUT="$APP_DIR/../dist/mac-arm64/mORTEX.app"
rm -rf "$APP_DIR/../mORTEX.app" && cp -R "$OUT" "$APP_DIR/../mORTEX.app"
/Volumes/SKYRIM/TOOLS/MAC/_tools/sign_app.sh "$APP_DIR/../mORTEX.app"
