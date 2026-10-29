#!/usr/bin/env python3
"""Génère catalog/exeSettings.ts : les réglages INI que SkyrimSE.exe connaît.

L'exécutable contient les noms de ses réglages sous la forme « réglage:section » (par exemple
« iShadowMapResolution:Display »). Ce sont des faits, sans texte d'auteur. À relancer pour une
autre version du jeu :

    python3 mac/gen_ini_catalog.py "/chemin/vers/SkyrimSE.exe" 1.6.1170
"""
import json
import re
import sys
from pathlib import Path

OUT = (
    Path(__file__).resolve().parent.parent
    / "src/renderer/src/extensions/ini_editor/catalog/exeSettings.ts"
)

# préfixe de type (b booléen, f réel, i entier, s texte, u entier non signé, r couleur) puis une
# majuscule ou un chiffre ; la section commence par une majuscule
SETTING = re.compile(rb"^([bfisur][A-Z0-9][A-Za-z0-9_ ]*):([A-Z][A-Za-z0-9_]*)$")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    exe, version = Path(sys.argv[1]), sys.argv[2]
    found = set()
    for run in re.findall(rb"[\x20-\x7e]{6,}", exe.read_bytes()):
        match = SETTING.match(run)
        if match:
            found.add((match.group(2).decode(), match.group(1).decode()))
    settings = sorted(found, key=lambda s: (s[0].lower(), s[1].lower()))
    lines = [
        "// Généré par mac/gen_ini_catalog.py : ne pas modifier à la main.",
        "// Réglages INI (section, clé) dont SkyrimSE.exe contient le nom.",
        f'export const EXE_GAME_VERSION = "{version}";',
        "",
        "export const EXE_SETTINGS: ReadonlyArray<readonly [section: string, key: string]> = [",
    ]
    lines += [f"  {json.dumps([section, key], ensure_ascii=False)}," for section, key in settings]
    lines.append("];")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"{len(settings)} réglages écrits dans {OUT}")


if __name__ == "__main__":
    main()
