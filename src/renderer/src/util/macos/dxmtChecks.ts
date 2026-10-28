/**
 * mORTEX (macOS) : bilan d'une bouteille CrossOver pour le rendu moderne de Skyrim SE sous DXMT
 * (Community Shaders « Bottled », presets ENB par le pont mDLSS). Voir l'Atelier DXMT.
 *
 * Interface :
 *  - runDxmtChecks(bottlePath, gamePath): Promise<IDxmtCheck[]>   les quatre contrôles
 *  - fixDisplayTweaks(gamePath): Promise<void>                     SSE Display Tweaks optimisé pour DXMT
 *  - useDxmt(bottlePath): Promise<void>                             moteur graphique de la bouteille sur DXMT
 *
 * Contrôles :
 *  - engine : moteur graphique de la bouteille (CX_GRAPHICS_BACKEND de cxbottle.conf) ; seul
 *    DXMT offre le niveau Direct3D 11 qu'exige Bottled Shaders
 *  - bridge : pont ENB de mDLSS (d3d11.dll à la racine du jeu), facultatif, pour les presets ENB
 *  - displayTweaks : réglages de SSE Display Tweaks pour DXMT (voir DISPLAY_TWEAKS) ; SwapEffect
 *    est obligatoire (seul flip_discard crée la swap chain, sinon 0x80070057 et écran noir), les
 *    autres sont des optimisations
 *  - bottledDuplicates : Terrain Helper et Inverse Square Lighting autonomes, déjà intégrés à
 *    Bottled Shaders, qui font planter le jeu (« na » sans Bottled Shaders)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { setBottleEnv } from "./bottleHealth";

export type DxmtCheckId = "engine" | "bridge" | "displayTweaks" | "bottledDuplicates";
export type DxmtCheckStatus = "ok" | "warning" | "error" | "na";

export interface IDxmtCheck {
  id: DxmtCheckId;
  status: DxmtCheckStatus;
  /** ce qui a été trouvé : moteur, valeur de SwapEffect, DLL en double */
  found?: string;
}

/** signature écrite par le pont ENB de mDLSS (son fichier journal) */
const BRIDGE_MARKER = "mDLSS_enb_bridge.log";
const PLUGINS_DIR = ["Data", "SKSE", "Plugins"];
const DISPLAY_TWEAKS_INI = "SSEDisplayTweaks.ini";

/**
 * Réglages [Render] validés sous DXMT (système « commun » de mDLSS) :
 *  - SwapEffect : obligatoire
 *  - SwapBufferCount : triple tampon, images plus régulières
 *  - VideoMemorySizeMb : DXMT signale mal la mémoire vidéo, que l'Apple Silicon partage avec la
 *    mémoire vive ; la moitié de la mémoire, plafonnée à 16 Go comme dans le système de référence
 */
export function displayTweaksTargets(totalMemory = os.totalmem()): Record<string, string> {
  const videoMb = Math.min(16384, Math.floor(totalMemory / 2 / 1024 / 1024 / 1024) * 1024);
  return { SwapEffect: "flip_discard", SwapBufferCount: "3", VideoMemorySizeMb: String(videoMb) };
}

const settingLine = (key: string) => new RegExp(`^(\\s*${key}\\s*=\\s*)([^\\s;#]*)(.*)$`, "im");

const readText = (file: string) => readFile(file, "utf8").catch(() => undefined);

export async function graphicsBackend(bottlePath: string): Promise<string | undefined> {
  const conf = await readText(path.join(bottlePath, "cxbottle.conf"));
  return conf?.match(/"CX_GRAPHICS_BACKEND"\s*=\s*"([^"]*)"/)?.[1]?.toLowerCase();
}

export async function hasEnbBridge(gamePath: string): Promise<boolean> {
  const dll = await readFile(path.join(gamePath, "d3d11.dll")).catch(() => undefined);
  return dll !== undefined && dll.includes(BRIDGE_MARKER);
}

/** valeurs actuelles des réglages visés ("" si absent), undefined sans SSE Display Tweaks */
export async function displayTweaksSettings(
  gamePath: string,
): Promise<Record<string, string> | undefined> {
  const ini = await readText(path.join(gamePath, ...PLUGINS_DIR, DISPLAY_TWEAKS_INI));
  if (ini === undefined) return undefined;
  return Object.fromEntries(
    Object.keys(displayTweaksTargets()).map((key) => [
      key,
      ini.match(settingLine(key))?.[2]?.toLowerCase() ?? "",
    ]),
  );
}

/** DLL autonomes en double avec Bottled Shaders, undefined si Bottled n'est pas installé */
export async function bottledDuplicates(gamePath: string): Promise<string[] | undefined> {
  const files = await readdir(path.join(gamePath, ...PLUGINS_DIR)).catch(() => [] as string[]);
  if (!files.some((file) => /^communityshaders\.dll$/i.test(file))) return undefined;
  return files.filter((file) => /^(terrain.?helper|inverse.?square.*)\.dll$/i.test(file));
}

export async function runDxmtChecks(bottlePath: string, gamePath: string): Promise<IDxmtCheck[]> {
  const [engine, bridge, tweaks, duplicates] = await Promise.all([
    graphicsBackend(bottlePath),
    hasEnbBridge(gamePath),
    displayTweaksSettings(gamePath),
    bottledDuplicates(gamePath),
  ]);
  return [
    { id: "engine", status: engine === "dxmt" ? "ok" : "error", found: engine ?? "" },
    { id: "bridge", status: bridge ? "ok" : "na" },
    displayTweaksCheck(tweaks),
    {
      id: "bottledDuplicates",
      status: duplicates === undefined ? "na" : duplicates.length > 0 ? "error" : "ok",
      found: duplicates?.join(", ") ?? "",
    },
  ];
}

function displayTweaksCheck(tweaks: Record<string, string> | undefined): IDxmtCheck {
  if (tweaks === undefined) return { id: "displayTweaks", status: "na" };
  const targets = displayTweaksTargets();
  const off = Object.keys(targets).filter((key) => tweaks[key] !== targets[key].toLowerCase());
  return {
    id: "displayTweaks",
    status: off.includes("SwapEffect") ? "error" : off.length > 0 ? "warning" : "ok",
    found: off.map((key) => `${key} = ${tweaks[key] || "?"}`).join(", "),
  };
}

export async function fixDisplayTweaks(gamePath: string): Promise<void> {
  const file = path.join(gamePath, ...PLUGINS_DIR, DISPLAY_TWEAKS_INI);
  let ini = await readFile(file, "utf8");
  if (!/^\s*\[Render\]\s*$/im.test(ini)) ini = `${ini.trimEnd()}\n\n[Render]\n`;
  for (const [key, value] of Object.entries(displayTweaksTargets())) {
    const line = settingLine(key);
    ini = line.test(ini)
      ? ini.replace(line, (_all, start: string, _old, rest: string) => `${start}${value}${rest}`)
      : ini.replace(/^(\s*\[Render\]\s*)$/im, `$1\n${key} = ${value}`);
  }
  // l'écriture traverse le lien : la copie du dossier de préparation suit
  await writeFile(file, ini);
}

/**
 * Passe la bouteille sur DXMT (CX_GRAPHICS_BACKEND de cxbottle.conf). CrossOver relit ce réglage
 * au démarrage de la bouteille : il vaut dès le prochain lancement du jeu.
 */
export async function useDxmt(bottlePath: string): Promise<void> {
  const file = path.join(bottlePath, "cxbottle.conf");
  const conf = await readFile(file, "utf8").catch(() => "");
  await writeFile(file, setBottleEnv(conf, "CX_GRAPHICS_BACKEND", "dxmt"));
}
