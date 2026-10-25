# mORTEX Mods Manager

**Français** · [English](#english)

mORTEX est un portage macOS (Apple Silicon) non officiel de [Vortex](https://github.com/Nexus-Mods/Vortex), le gestionnaire de mods de Nexus Mods. Il gère Skyrim Special Edition lancé dans une bouteille Wine (CrossOver, Whisky). Il n'est ni affilié à Nexus Mods ni approuvé par elle.

## Ce qui fonctionne

- Détection de Skyrim SE dans les bouteilles CrossOver et Whisky, lancement du jeu et des outils dans la bouteille.
- Liens `nxm://` (« Mod Manager Download »), installation de mods (`.zip`, `.7z`, `.rar`) et de FOMOD XML.
- Déploiement par liens physiques (le dossier de staging doit être sur le même volume que le jeu) et retrait propre.
- Tri automatique des plugins avec LOOT (libloot 0.29).

## Installer

```bash
source mac/env.sh      # Node 24 et pnpm
mac/rebuild.sh         # dépendances et addons natifs (7zz, FOMOD NativeAOT, libloot)
mac/package.sh         # construit, signe et installe mORTEX.app
```

Prérequis : Homebrew (`node@24`, `dotnet`, `cmake`), Rust (rustup), Xcode.

## Limites connues

- Scripts FOMOD en C# non pris en charge (seul le FOMOD XML l'est).
- Skyrim SE uniquement pour l'instant ; pas de mise à jour automatique ni de télémétrie.

Licence GPL-3.0 comme Vortex. Voir [NOTICE-mORTEX.md](NOTICE-mORTEX.md).

---

## English

mORTEX is an unofficial macOS (Apple Silicon) port of [Vortex](https://github.com/Nexus-Mods/Vortex), the Nexus Mods mod manager. It manages Skyrim Special Edition running in a Wine bottle (CrossOver, Whisky). It is neither affiliated with nor endorsed by Nexus Mods.

### What works

- Skyrim SE detection in CrossOver and Whisky bottles; the game and tools launch inside the bottle.
- `nxm://` links ("Mod Manager Download"), mod installation (`.zip`, `.7z`, `.rar`) and XML FOMODs.
- Hardlink deployment (the staging folder must be on the same volume as the game) and clean purge.
- Automatic plugin sorting with LOOT (libloot 0.29).

### Build

```bash
source mac/env.sh      # Node 24 and pnpm
mac/rebuild.sh         # dependencies and native addons (7zz, FOMOD NativeAOT, libloot)
mac/package.sh         # builds, signs and installs mORTEX.app
```

Requirements: Homebrew (`node@24`, `dotnet`, `cmake`), Rust (rustup), Xcode.

### Known limits

- C# FOMOD scripts are not supported (XML FOMOD only).
- Skyrim SE only for now; no auto-update and no telemetry.

GPL-3.0 licensed, like Vortex. See [NOTICE-mORTEX.md](NOTICE-mORTEX.md).
