#!/bin/bash
# mORTEX : installe les dépendances et recompile les addons natifs pour Electron (arm64).
# Le postinstall de src/main est reporté (VORTEX_ELECTRON_REBUILD=defer) car electron-rebuild
# ne sait pas exclure un module : on liste ici ceux qui compilent sur macOS.
# FOMOD natif et 7zz : mac/fomod_native.sh et mac/install_7zz.sh (étape 3). LOOT (étape 5) à venir.
set -e
cd "$(dirname "$0")/.."
source mac/env.sh
VORTEX_ELECTRON_REBUILD=defer pnpm install
cd src/main
pnpm exec electron-rebuild --arch arm64 -o drivelist,leveldown,winapi-bindings,xxhash-addon,@parcel/watcher
cd ../..
mac/install_7zz.sh
mac/fomod_native.sh
