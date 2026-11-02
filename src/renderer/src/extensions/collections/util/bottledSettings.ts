/**
 * mORTEX (macOS) : que faire des réglages de Community Shaders que la collection apporte quand
 * Bottled Shaders prend sa place. Rien ne garantit qu'ils conviennent à Bottled : trois choix,
 * appliqués au SettingsUser.json de Bottled (Data/SKSE/Plugins/CommunityShaders/), avec une copie
 * gardée pour « Annuler ».
 *
 *  - keep    : garder les réglages de la collection (le fichier n'est pas touché)
 *  - mortex  : les réglages mORTEX pour DXMT, ceux de la recette de l'Atelier (DLSS pour la mise à
 *              l'échelle, TAA quand DLSS manque, jamais FSR ; post-traitement chargé au démarrage ;
 *              génération d'images désactivée) ; le reste prend les valeurs de Bottled
 *  - default : les réglages par défaut de Bottled (le fichier de la collection est retiré)
 *
 * Interface :
 *  - applyBottledSettings(gamePath, choice): Promise<() => Promise<void>>   rend l'annulation
 *  - restoreBottledSettings(gamePath) / hasBottledSettingsBackup(gamePath)  l'annulation, plus tard
 *  - mortexSettings(): object                                               le contenu « mortex »
 */
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

export type BottledSettingsChoice = "keep" | "mortex" | "default";

export const BOTTLED_SETTINGS_CHOICES: readonly BottledSettingsChoice[] = [
  "mortex",
  "keep",
  "default",
];

/** attribut du mod de collection : le choix fait dans le dialogue de départ */
export const ATTR_SETTINGS_CHOICE = "mortexBottledSettings";
/** attribut du mod de collection : le choix a été appliqué (une seule fois par installation) */
export const ATTR_SETTINGS_APPLIED = "mortexBottledSettingsApplied";

/** textes (à traduire) des trois choix, pour le dialogue de départ et l'Atelier */
export const BOTTLED_SETTINGS_TEXTS: Record<
  BottledSettingsChoice,
  { title: string; detail: string }
> = {
  mortex: {
    title: "mORTEX settings for DXMT (recommended)",
    detail: "TAA for upscaling, frame generation off: the ones that work on a Mac.",
  },
  keep: {
    title: "The collection's settings",
    detail: "Kept as the author wrote them. They may cause a red screen or missing effects.",
  },
  default: {
    title: "Bottled Shaders defaults",
    detail: "Every setting starts from scratch. You can adjust them in the game.",
  },
};

export function isBottledSettingsChoice(value: unknown): value is BottledSettingsChoice {
  return BOTTLED_SETTINGS_CHOICES.includes(value as BottledSettingsChoice);
}

/**
 * Réglages de la recette de l'Atelier DXMT :
 *  - DLSS pour la mise à l'échelle (3) : Streamline le charge sous DXMT (« DLSS is available » dans
 *    le journal), validé dans les essais du 15/10 ; TAA (1) quand DLSS manque, jamais FSR (2), qui
 *    se comporte mal sous DXMT ;
 *  - post-traitement chargé au démarrage (Bottled le désactive par défaut) : sans lui, les
 *    transparences et les reflets métalliques disparaissent ;
 *  - génération d'images désactivée (écran noir sous CrossOver).
 */
export function mortexSettings() {
  return {
    "Disable at Boot": { PostProcessing: false },
    Upscaling: {
      upscaleMethod: 3,
      upscaleMethodNoDLSS: 1,
      upscaleMethodNoFSR: 1,
      frameGenerationMode: 0,
      frameGenerationForceEnable: 0,
    },
  };
}

export const settingsUserPath = (gamePath: string) =>
  path.join(gamePath, "Data", "SKSE", "Plugins", "CommunityShaders", "SettingsUser.json");

/** la copie des réglages d'avant, gardée sur le disque pour qu'« Annuler » reste possible plus tard */
const backupPath = (gamePath: string) => settingsUserPath(gamePath) + ".mortex-backup";
/** le fichier n'existait pas avant : annuler le supprime */
const absentPath = (gamePath: string) => settingsUserPath(gamePath) + ".mortex-absent";

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

/** y a-t-il des réglages d'avant à remettre ? */
export async function hasBottledSettingsBackup(gamePath: string): Promise<boolean> {
  return (await exists(backupPath(gamePath))) || (await exists(absentPath(gamePath)));
}

/** remet les réglages d'avant l'application d'un choix, puis efface la copie */
export async function restoreBottledSettings(gamePath: string): Promise<void> {
  const file = settingsUserPath(gamePath);
  if (await exists(backupPath(gamePath))) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, await readFile(backupPath(gamePath)));
    await rm(backupPath(gamePath), { force: true });
  } else if (await exists(absentPath(gamePath))) {
    await rm(file, { force: true });
    await rm(absentPath(gamePath), { force: true });
  }
}

/**
 * Applique le choix. Rend de quoi remettre le fichier comme il était (même absent). Le fichier
 * est réécrit sur place : s'il est déployé par un mod, la copie de ce mod suit, comme pour les
 * autres réglages de l'Atelier. La première copie est gardée : un second choix ne l'écrase pas.
 */
export async function applyBottledSettings(
  gamePath: string,
  choice: BottledSettingsChoice,
): Promise<() => Promise<void>> {
  const undo = () => restoreBottledSettings(gamePath);
  if (choice === "keep") return async () => undefined;
  const file = settingsUserPath(gamePath);
  if (!(await hasBottledSettingsBackup(gamePath))) {
    const before = await readFile(file).catch(() => undefined);
    await mkdir(path.dirname(file), { recursive: true });
    if (before === undefined) {
      await writeFile(absentPath(gamePath), "");
    } else {
      await writeFile(backupPath(gamePath), before);
    }
  }
  if (choice === "default") {
    await rm(file, { force: true });
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(mortexSettings(), null, 2) + "\n");
  }
  return undo;
}
