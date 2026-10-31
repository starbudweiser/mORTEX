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

export type BethesdaPresetId = "low" | "medium" | "high" | "ultra" | "mac";

export const BETHESDA_PRESET_IDS: readonly BethesdaPresetId[] = [
  "low",
  "medium",
  "high",
  "ultra",
  "mac",
];

/**
 * Préréglage « Mac » : le préréglage Élevé de Bethesda (lu dans le dossier du jeu), allégé là où
 * un Mac Silicon (M1 Max et au-delà, via la couche de traduction graphique) perd le plus pour le
 * moins de qualité visible : ombres un peu plus courtes, pas d'occlusion ambiante ni de reflets
 * d'écran, anticrénelage temporel plutôt que multi-échantillonnage. Même esprit que la base
 * « équilibrée » de BethINI ; conseil général, non mesuré sur chaque machine.
 */
export const MAC_OVERRIDES: readonly IChange[] = [
  { section: "Display", key: "iShadowMapResolution", value: "2048" },
  { section: "Display", key: "fShadowDistance", value: "8000" },
  { section: "Display", key: "fInteriorShadowDistance", value: "3000" },
  { section: "Display", key: "iMaxAnisotropy", value: "8" },
  { section: "Display", key: "iMultiSample", value: "0" },
  { section: "Display", key: "bUseTAA", value: "1" },
  { section: "Display", key: "bFXAAEnabled", value: "0" },
  { section: "Display", key: "bSAOEnable", value: "0" },
  { section: "Display", key: "bScreenSpaceReflectionEnabled", value: "0" },
  { section: "Display", key: "bShadowsOnGrass", value: "0" },
  { section: "Display", key: "iPresentInterval", value: "1" },
];

/** Fichier de Bethesda sous-jacent (le préréglage Mac part du préréglage Élevé) */
function withMacOverrides(high: IChange[]): IChange[] {
  const over = new Set(MAC_OVERRIDES.map((c) => `${c.section}|${c.key}`.toLowerCase()));
  return [
    ...high.filter((c) => !over.has(`${c.section}|${c.key}`.toLowerCase())),
    ...MAC_OVERRIDES,
  ];
}

export interface IBethesdaValues {
  /** Skyrim_Default.ini */
  defaults: IChange[];
  /** Skyrim/SkyrimPrefs.ini */
  launcherPrefs: IChange[];
  presets: Record<BethesdaPresetId, IChange[]>;
}

const PRESET_FILES: Record<Exclude<BethesdaPresetId, "mac">, string> = {
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
  const fileIds = BETHESDA_PRESET_IDS.filter(
    (id): id is Exclude<BethesdaPresetId, "mac"> => id !== "mac",
  );
  const [defaults, launcherPrefs, ...presets] = await Promise.all([
    valuesOf(path.join(gameDir, "Skyrim_Default.ini")),
    valuesOf(path.join(gameDir, "Skyrim", "SkyrimPrefs.ini")),
    ...fileIds.map((id) => valuesOf(path.join(gameDir, PRESET_FILES[id]))),
  ]);
  const byId = Object.fromEntries(fileIds.map((id, i) => [id, presets[i]])) as Record<
    Exclude<BethesdaPresetId, "mac">,
    IChange[]
  >;
  return {
    defaults,
    launcherPrefs,
    presets: { ...byId, mac: withMacOverrides(byId.high) },
  };
}
