#!/bin/bash
# mORTEX : LOOT (libloot) sur macOS arm64 (étape 5).
#  1. compile libloot (amont, CMake + Rust) en libloot.0.dylib ;
#  2. compile l'addon N-API node-loot contre cette dylib avec mac/loot/binding.darwin.gyp,
#     dans le paquet `loot` du magasin pnpm.
# Usage : mac/loot_native.sh   Journaux : logs/libloot.log, logs/loot_addon.log
# Prérequis : cmake et rust (rustup) ; libloot 0.29.x (version des en-têtes de loot_api/include).
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$APP_DIR/mac/env.sh"
export PATH="$HOME/.cargo/bin:$PATH"
VERSION=0.29.6
SRC="$APP_DIR/mac/native/libloot"
OUT="$APP_DIR/mac/native/out"
mkdir -p "$APP_DIR/logs" "$OUT"

if [ ! -f "$OUT/libloot.0.dylib" ]; then
  [ -d "$SRC" ] || git clone --depth 1 --branch "$VERSION" https://github.com/loot/libloot.git "$SRC"
  # libc++ (macOS) n'inclut pas <string> et <cstdint> implicitement, contrairement à libstdc++
  (cd "$SRC/cpp" && rm -rf build \
    && cmake -DCMAKE_BUILD_TYPE=Release -DLIBLOOT_BUILD_TESTS=OFF \
         -DCMAKE_CXX_FLAGS="-include string -include cstdint" -B build \
    && cmake --build build --parallel) > "$APP_DIR/logs/libloot.log" 2>&1 \
    || { tail -20 "$APP_DIR/logs/libloot.log"; exit 1; }
  cp -L "$SRC/cpp/build/libloot.0.dylib" "$OUT/libloot.0.dylib"
  install_name_tool -id @rpath/libloot.0.dylib "$OUT/libloot.0.dylib"
fi

PKG="$(ls -d "$APP_DIR"/node_modules/.pnpm/loot@*/node_modules/loot | head -1)"
echo "addon N-API : $PKG"
cp "$OUT/libloot.0.dylib" "$PKG/loot_api/"
cp "$APP_DIR/mac/loot/binding.darwin.gyp" "$PKG/binding.gyp"
(cd "$PKG" && rm -rf build && pnpm dlx node-gyp rebuild) > "$APP_DIR/logs/loot_addon.log" 2>&1 \
  || { tail -20 "$APP_DIR/logs/loot_addon.log"; exit 1; }
cp "$OUT/libloot.0.dylib" "$PKG/build/Release/"  # rpath @loader_path : à côté de node-loot.node (comme dans le paquet)
