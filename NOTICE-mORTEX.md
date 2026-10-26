# Notices / Mentions légales — mORTEX

mORTEX is a derivative work of **Vortex** © Black Tree Gaming Ltd. / Nexus Mods, licensed under the
**GNU General Public License v3.0** (see `LICENSE.md`). mORTEX is distributed under the same licence;
its changes are in this repository's history. mORTEX is not affiliated with or endorsed by Nexus Mods.
"Nexus Mods" and "Vortex" are their owners' trademarks.

## Components added for macOS / Composants ajoutés pour macOS

| Component                                       | Licence                        | Where / Où                                                                                    |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| 7-Zip (`7zz`, arm64) © Igor Pavlov              | GNU LGPL (+ unRAR restriction) | `mac/vendor/7zip/7zz`, https://www.7-zip.org                                                  |
| The Unarchiver (`unar` 1.10, arm64) © Dag Ågren | GNU LGPL 2.1                   | `mac/vendor/unar/unar` (Homebrew), https://theunarchiver.com — repli pour les RAR de WinRAR 7 |
| libloot 0.29.6 © Ortham (LOOT)                  | GPL-3.0                        | built by `mac/loot_native.sh`, https://github.com/loot/libloot                                |
| fomod-installer (NativeAOT) © Nexus Mods        | GPL-3.0                        | built by `mac/fomod_native.sh`, https://github.com/Nexus-Mods/fomod-installer                 |
| node-loot © Black Tree Gaming                   | GPL-3.0                        | https://github.com/Nexus-Mods/node-loot                                                       |

The unRAR code in 7-Zip may not be used to recreate the RAR compression algorithm.
Wine, CrossOver are not bundled: they are separate products with their own licences.
The full list of npm dependencies and their licences is in `src/main/build/assets/bom.json` (generated at build time).
