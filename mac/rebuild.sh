#!/bin/bash
# mORTEX : installe les dépendances et recompile les addons natifs pour Electron (arm64).
# Le postinstall de src/main est reporté (VORTEX_ELECTRON_REBUILD=defer) car electron-rebuild
# ne sait pas exclure un module : on liste ici ceux qui compilent sur macOS.
# FOMOD natif (étape 3) et LOOT (étape 5) seront ajoutés une fois portés.
set -e
cd "$(dirname "$0")/.."
source mac/env.sh
VORTEX_ELECTRON_REBUILD=defer pnpm install
cd src/main
pnpm exec electron-rebuild --arch arm64 -o drivelist,leveldown,winapi-bindings,xxhash-addon,@parcel/watcher
