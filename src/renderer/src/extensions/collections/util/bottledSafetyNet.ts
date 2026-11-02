/**
 * mORTEX (macOS) : le filet sous la substitution de Bottled Shaders à Community Shaders. La liste
 * des modules de Community Shaders écartés à la lecture de la collection (CS_FEATURE_MODS) peut
 * oublier un module. Après le déploiement, mORTEX compare donc les fichiers : un mod activé dont les
 * fichiers `Shaders/Features/*.ini` et `Shaders/<Module>/**` sont tous aussi fournis par Bottled
 * Shaders fait double emploi, et mORTEX le désactive. Ce qui est désactivé est listé dans le bilan
 * de fin d'installation, avec un bouton « Annuler ». Les mods restent installés.
 *
 * Interface :
 *  - findFeatureDuplicates(bottledFiles, candidates): string[]   la décision, sans disque
 *  - runSafetyNet(api, gameId, collectionMod): Promise<ISafetyNetResult | undefined>
 *  - undoSafetyNet(api, gameId, collectionModId): Promise<void>
 */
import { readdir } from "node:fs/promises";
import * as path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { setModAttribute } from "../../../actions";
import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { installPathForGame } from "../../mod_management/selectors";
import type { IMod } from "../../mod_management/types/IMod";
import { getManifest } from "../../mod_management/util/activationStore";
import renderModName from "../../mod_management/util/modName";
import { setModsEnabled } from "../../profile_management/actions/profiles";
import { activeProfile } from "../../profile_management/selectors";
import { BOTTLED_MOD_ID, CS_FEATURE_MODS, CS_MOD_ID } from "./macRenderSubstitution";

/** attribut du mod de collection : ce que le filet a désactivé, montré dans le bilan */
export const ATTR_SAFETY_NET = "mortexSafetyNet";

export interface ISafetyNetResult {
  profileId: string;
  disabled: Array<{ id: string; name: string; why: "duplicate" | "stock" | "incompatible" }>;
  /** le joueur a annulé : les mods ont été réactivés et le filet ne repasse plus */
  undone?: boolean;
}

const FEATURE_INI = /^shaders\/features\/[^/]+\.ini$/;
/** DLL que Bottled Shaders refuse : il coupe alors tous ses effets au lancement du jeu */
const INCOMPATIBLE_DLL = /^skse\/plugins\/evlas\.dll$/;

const normalize = (relPath: string) => relPath.replace(/\\/g, "/").toLowerCase();

/**
 * Parmi les candidats (mods qui déploient un `Shaders/Features/*.ini`), ceux dont tous les fichiers
 * de `Shaders/` sont aussi fournis par Bottled Shaders.
 */
export function findFeatureDuplicates(
  bottledFiles: Iterable<string>,
  candidates: Array<{ id: string; files: string[] }>,
): string[] {
  const bottled = new Set([...bottledFiles].map(normalize));
  return candidates
    .filter(({ files }) => {
      const shaders = files.map(normalize).filter((file) => file.startsWith("shaders/"));
      return (
        shaders.some((file) => FEATURE_INI.test(file)) && shaders.every((file) => bottled.has(file))
      );
    })
    .map(({ id }) => id);
}

export const nexusModId = (mod: IMod): number => Number(mod.attributes?.modId);

export const isBottled = (mod: IMod) => nexusModId(mod) === BOTTLED_MOD_ID;

/** le Community Shaders d'origine, ou l'un de ses modules connus */
export const isStockPack = (mod: IMod) =>
  nexusModId(mod) === CS_MOD_ID || CS_FEATURE_MODS[nexusModId(mod)] !== undefined;

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(root, path.join((entry as any).parentPath ?? (entry as any).path, entry.name)),
    );
}

/**
 * Désactive, dans le profil actif, ce que Bottled Shaders rend inutile ou gênant. Rend undefined si
 * Bottled n'est pas installé et activé (rien n'est alors désactivé) ou si le joueur a déjà annulé.
 */
export async function runSafetyNet(
  api: IExtensionApi,
  gameId: string,
  collectionMod: IMod,
): Promise<ISafetyNetResult | undefined> {
  const state = api.getState();
  const profile = activeProfile(state);
  if (profile === undefined || profile.gameId !== gameId) return undefined;
  if ((collectionMod.attributes?.[ATTR_SAFETY_NET] as ISafetyNetResult)?.undone === true) {
    return undefined;
  }

  const mods: Record<string, IMod> = state.persistent.mods[gameId] ?? {};
  const enabled = (mod: IMod) => profile.modState?.[mod.id]?.enabled === true;
  const bottled = Object.values(mods).find(
    (mod) => mod.state === "installed" && isBottled(mod) && enabled(mod),
  );
  if (bottled === undefined) return undefined;

  const disabled: ISafetyNetResult["disabled"] = [];
  const disable = (mod: IMod, why: ISafetyNetResult["disabled"][number]["why"]) => {
    if (!disabled.some((iter) => iter.id === mod.id)) {
      disabled.push({ id: mod.id, name: renderModName(mod), why });
    }
  };

  // le Community Shaders d'origine et ses modules connus, s'ils sont activés dans ce profil
  Object.values(mods)
    .filter((mod) => mod.state === "installed" && isStockPack(mod) && enabled(mod))
    .forEach((mod) => disable(mod, "stock"));

  // les autres : DLL incompatibles, puis comparaison des fichiers
  try {
    const stagingPath = installPathForGame(state, gameId);
    const manifest = await getManifest(api, "", gameId);
    const incompatible = new Set(
      manifest.files
        .filter((file) => INCOMPATIBLE_DLL.test(normalize(file.relPath)))
        .map((file) => file.source),
    );
    Object.values(mods)
      .filter(
        (mod) => enabled(mod) && mod.id !== bottled.id && incompatible.has(mod.installationPath),
      )
      .forEach((mod) => disable(mod, "incompatible"));
    const sources = new Set(
      manifest.files
        .filter((file) => FEATURE_INI.test(normalize(file.relPath)))
        .map((file) => file.source),
    );
    const candidates = Object.values(mods).filter(
      (mod) =>
        enabled(mod) &&
        mod.id !== bottled.id &&
        mod.type !== "collection" &&
        sources.has(mod.installationPath) &&
        !disabled.some((iter) => iter.id === mod.id),
    );
    if (candidates.length > 0) {
      const bottledFiles = await listFiles(path.join(stagingPath, bottled.installationPath));
      const listed = await Promise.all(
        candidates.map(async (mod) => ({
          id: mod.id,
          files: await listFiles(path.join(stagingPath, mod.installationPath)),
        })),
      );
      for (const id of findFeatureDuplicates(bottledFiles, listed)) disable(mods[id], "duplicate");
    }
  } catch (err) {
    log("warn", "Bottled Shaders safety net could not compare files", {
      error: getErrorMessageOrDefault(err),
    });
  }

  if (disabled.length === 0) return undefined;
  await setModsEnabled(
    api,
    profile.id,
    disabled.map((iter) => iter.id),
    false,
  );
  const result: ISafetyNetResult = { profileId: profile.id, disabled };
  api.store.dispatch(setModAttribute(gameId, collectionMod.id, ATTR_SAFETY_NET, result));
  return result;
}

/** réactive ce que le filet a désactivé ; il ne repasse plus sur cette collection */
export async function undoSafetyNet(
  api: IExtensionApi,
  gameId: string,
  collectionModId: string,
): Promise<void> {
  const mod: IMod | undefined = api.getState().persistent.mods[gameId]?.[collectionModId];
  const result = mod?.attributes?.[ATTR_SAFETY_NET] as ISafetyNetResult | undefined;
  if (result === undefined || result.undone === true) return;
  await setModsEnabled(
    api,
    result.profileId,
    result.disabled.map((iter) => iter.id),
    true,
  );
  api.store.dispatch(
    setModAttribute(gameId, collectionModId, ATTR_SAFETY_NET, { ...result, undone: true }),
  );
}
