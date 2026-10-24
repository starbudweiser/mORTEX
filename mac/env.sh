# mORTEX : environnement de build macOS. À sourcer avant pnpm : `source mac/env.sh`.
# - Node 24 (Homebrew node@24) et pnpm 11 ; pnpm télécharge lui-même la version exacte de Node exigée.
# - Exceptions C++ activées pour les addons N-API (node-gyp les coupe par défaut sur macOS, y compris en .mm).
export PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH
export CXXFLAGS="-fexceptions" OBJCXXFLAGS="-fexceptions"
