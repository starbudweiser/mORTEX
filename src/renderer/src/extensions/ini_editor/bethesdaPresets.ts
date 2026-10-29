/**
 * Valeurs de Bethesda lues à l'exécution dans le dossier du jeu de l'utilisateur (rien n'est
 * redistribué) :
 *  - Skyrim_Default.ini : valeurs par défaut du jeu
 *  - Low.ini, Medium.ini, High.ini, Ultra.ini : préréglages graphiques du lanceur
 *  - Skyrim/SkyrimPrefs.ini : modèle de préférences du lanceur
 * Un fichier absent donne une liste vide : la page n'affiche alors que ce qui existe.
 */
import * as path from "node:path";

import { type IChange, loadIniFile, readEffective } from "../../util/macos/iniEdit";

export type BethesdaPresetId = "low" | "medium" | "high" | "ultra";

export const BETHESDA_PRESET_IDS: readonly BethesdaPresetId[] = ["low", "medium", "high", "ultra"];

export interface IBethesdaValues {
  /** Skyrim_Default.ini */
  defaults: IChange[];
  /** Skyrim/SkyrimPrefs.ini */
  launcherPrefs: IChange[];
  presets: Record<BethesdaPresetId, IChange[]>;
}

const PRESET_FILES: Record<BethesdaPresetId, string> = {
  low: "Low.ini",
  medium: "Medium.ini",
  high: "High.ini",
  ultra: "Ultra.ini",
};

async function valuesOf(file: string): Promise<IChange[]> {
  const loaded = await loadIniFile("ini", file);
  return [...readEffective([loaded]).values()].map(({ section, key, value }) => ({
    section,
    key,
    value,
  }));
}

export async function readBethesdaValues(gameDir: string): Promise<IBethesdaValues> {
  const [defaults, launcherPrefs, ...presets] = await Promise.all([
    valuesOf(path.join(gameDir, "Skyrim_Default.ini")),
    valuesOf(path.join(gameDir, "Skyrim", "SkyrimPrefs.ini")),
    ...BETHESDA_PRESET_IDS.map((id) => valuesOf(path.join(gameDir, PRESET_FILES[id]))),
  ]);
  return {
    defaults,
    launcherPrefs,
    presets: Object.fromEntries(BETHESDA_PRESET_IDS.map((id, i) => [id, presets[i]])) as Record<
      BethesdaPresetId,
      IChange[]
    >,
  };
}
