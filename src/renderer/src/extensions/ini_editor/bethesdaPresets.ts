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

export type BethesdaPresetId =
  | "low"
  | "medium"
  | "high"
  | "ultra"
  | "macLow"
  | "macMid"
  | "macUltra";

export const BETHESDA_PRESET_IDS: readonly BethesdaPresetId[] = [
  "low",
  "medium",
  "high",
  "ultra",
  "macLow",
  "macMid",
  "macUltra",
];

type BethesdaFileId = "low" | "medium" | "high" | "ultra";

const display = (key: string, value: string): IChange => ({ section: "Display", key, value });

/**
 * Préréglages « Mac » : un par palier de puce Apple Silicon, chacun construit sur le préréglage
 * Bethesda de même niveau (lu dans le dossier du jeu) dont les réglages les plus coûteux sous la
 * couche de traduction graphique sont ajustés. Même esprit que la base « équilibrée » de BethINI ;
 * conseils généraux, non mesurés sur chaque machine.
 *  - macLow  : M1 Max (32 cœurs GPU), base Moyen
 *  - macMid  : M3 Max (40 cœurs GPU), base Élevé
 *  - macUltra: M5 Max (40 cœurs GPU), base Ultra
 */
export const MAC_TIERS: Record<
  "macLow" | "macMid" | "macUltra",
  { base: BethesdaFileId; overrides: readonly IChange[] }
> = {
  macLow: {
    base: "medium",
    overrides: [
      display("iShadowMapResolution", "2048"),
      display("fShadowDistance", "6000"),
      display("fInteriorShadowDistance", "2500"),
      display("iMaxAnisotropy", "4"),
      display("iMultiSample", "0"),
      display("bUseTAA", "1"),
      display("bFXAAEnabled", "0"),
      display("bSAOEnable", "0"),
      display("bScreenSpaceReflectionEnabled", "0"),
      display("bShadowsOnGrass", "0"),
      display("iPresentInterval", "1"),
    ],
  },
  macMid: {
    base: "high",
    overrides: [
      display("iShadowMapResolution", "2048"),
      display("fShadowDistance", "8000"),
      display("fInteriorShadowDistance", "3000"),
      display("iMaxAnisotropy", "8"),
      display("iMultiSample", "0"),
      display("bUseTAA", "1"),
      display("bFXAAEnabled", "0"),
      display("bSAOEnable", "0"),
      display("bScreenSpaceReflectionEnabled", "0"),
      display("bShadowsOnGrass", "0"),
      display("iPresentInterval", "1"),
    ],
  },
  macUltra: {
    base: "ultra",
    overrides: [
      display("iShadowMapResolution", "4096"),
      display("fShadowDistance", "10000"),
      display("fInteriorShadowDistance", "3000"),
      display("iMaxAnisotropy", "16"),
      display("iMultiSample", "0"),
      display("bUseTAA", "1"),
      display("bFXAAEnabled", "0"),
      display("bSAOEnable", "1"),
      display("bScreenSpaceReflectionEnabled", "1"),
      display("bShadowsOnGrass", "1"),
      display("iPresentInterval", "1"),
    ],
  },
};

/** le préréglage de base de Bethesda, puis les réglages du palier par-dessus */
function withOverrides(base: IChange[], overrides: readonly IChange[]): IChange[] {
  const over = new Set(overrides.map((c) => `${c.section}|${c.key}`.toLowerCase()));
  return [...base.filter((c) => !over.has(`${c.section}|${c.key}`.toLowerCase())), ...overrides];
}

export interface IBethesdaValues {
  /** Skyrim_Default.ini */
  defaults: IChange[];
  /** Skyrim/SkyrimPrefs.ini */
  launcherPrefs: IChange[];
  presets: Record<BethesdaPresetId, IChange[]>;
}

const PRESET_FILES: Record<BethesdaFileId, string> = {
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
  const fileIds: BethesdaFileId[] = ["low", "medium", "high", "ultra"];
  const [defaults, launcherPrefs, ...presets] = await Promise.all([
    valuesOf(path.join(gameDir, "Skyrim_Default.ini")),
    valuesOf(path.join(gameDir, "Skyrim", "SkyrimPrefs.ini")),
    ...fileIds.map((id) => valuesOf(path.join(gameDir, PRESET_FILES[id]))),
  ]);
  const byId = Object.fromEntries(fileIds.map((id, i) => [id, presets[i]])) as Record<
    BethesdaFileId,
    IChange[]
  >;
  return {
    defaults,
    launcherPrefs,
    presets: {
      ...byId,
      macLow: withOverrides(byId[MAC_TIERS.macLow.base], MAC_TIERS.macLow.overrides),
      macMid: withOverrides(byId[MAC_TIERS.macMid.base], MAC_TIERS.macMid.overrides),
      macUltra: withOverrides(byId[MAC_TIERS.macUltra.base], MAC_TIERS.macUltra.overrides),
    },
  };
}
