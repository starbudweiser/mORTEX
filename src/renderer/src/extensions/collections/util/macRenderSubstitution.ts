/**
 * mORTEX (macOS) : Bottled Shaders à la place de Community Shaders dans les collections Skyrim SE.
 *
 * Sous CrossOver et DXMT, seul Bottled Shaders (fork de Community Shaders préparé pour le Mac)
 * fonctionne. Une collection pensée pour Windows apporte le Community Shaders d'origine, avec des
 * modules plus récents qu'il ne sait pas charger (« 1798 shaders failed to compile »). À la lecture
 * de la collection, mORTEX remplace donc Community Shaders par Bottled, écarte les modules que
 * Bottled intègre déjà et Dynamic Terrain Deformation (qui fait s'arrêter le jeu), et garde la
 * trace de ce changement (`collection.mortexSubstitution`) pour l'annonce, le bilan et le retour
 * en arrière. Rien n'est caché : chaque mod écarté est listé avec sa raison.
 *
 * Interface :
 *  - substituteRenderMods(api, collection, manifest): Promise<ICollection | undefined>
 *      point d'entrée, appelé par readCollection ; undefined = rien à changer
 *  - substituteCollection(collection, bottled): ICollection | undefined   la substitution pure
 *  - latestBottledFile(api)                                              dernier fichier principal
 */
import * as path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { activeGameId } from "../../../util/selectors";
import type { IMod, IModReference } from "../../mod_management/types/IMod";
import { MOD_TYPE } from "../constants";
import type { ICollection, ICollectionMod, ICollectionModRule } from "../types/ICollection";

export const SKYRIM_DOMAIN = "skyrimspecialedition";
export const SKYRIM_GAME = "skyrimse";

/** Community Shaders d'origine sur Nexus */
export const CS_MOD_ID = 86492;
/** Bottled Shaders sur Nexus */
export const BOTTLED_MOD_ID = 192816;
export const BOTTLED_URL = `https://www.nexusmods.com/${SKYRIM_DOMAIN}/mods/${BOTTLED_MOD_ID}`;
export const BOTTLED_NAME = "Bottled Shaders";
/** étiquette du membre Bottled dans la collection : les règles qui visaient CS la reprennent */
export const BOTTLED_TAG = "mortex-bottled-shaders";

/** attributs posés sur le mod de la collection */
export const ATTR_SUBSTITUTION = "mortexSubstitution";
/** le joueur a demandé le Community Shaders de la collection : plus de substitution pour celle-ci */
export const ATTR_SUBSTITUTION_OFF = "mortexSubstitutionOff";

/**
 * Modules de Community Shaders que Bottled Shaders intègre (identifiants Nexus, Skyrim SE).
 * Les cinq premiers viennent du staging du 02/11/2026 ; les autres sont rattrapés par leur nom
 * (voir CS_FEATURE_NAMES) et, après l'installation, par le filet qui compare les fichiers.
 */
export const CS_FEATURE_MODS: Readonly<Record<number, string>> = {
  86502: "Grass Lighting",
  87816: "Grass Collision",
  99548: "Light Limit Fix",
  130375: "Screen Space GI",
  139352: "Skylighting",
  139185: "Cloud Shadows",
  112739: "Wetness Effects",
  112762: "Water Effects",
};

/**
 * Noms assez précis pour reconnaître un module sans son identifiant. « Water Effects » et
 * « Wetness Effects » sont trop courants pour qu'on s'y fie : ils ne passent que par leur
 * identifiant.
 */
const CS_FEATURE_NAMES =
  /^(?:community shaders\W+)?(?:grass lighting|grass collision|light limit fix|screen space gi|screen space shadows|skylighting|cloud shadows|subsurface scattering|terrain shadows|terrain blending|extended materials|volumetric lighting|lod blending|dynamic cubemaps|terrain helper|inverse square lighting)\b/i;

/** incompatible avec Bottled Shaders : fait s'arrêter le jeu */
const INCOMPATIBLE_NAMES = /dynamic terrain deformation/i;

export type RemovedReason = "feature" | "incompatible";

export interface IBottledFile {
  fileId: number;
  version: string;
}

export interface IRemovedMod {
  name: string;
  modId?: number;
  reason: RemovedReason;
}

export interface ISubstitution {
  bottled: IBottledFile & { modId: number; name: string; tag: string };
  /** le Community Shaders d'origine que Bottled remplace */
  replaced: { name: string; version: string; modId: number };
  /** les mods écartés, avec la raison */
  removed: IRemovedMod[];
}

const isNexus = (mod: ICollectionMod) =>
  mod.source?.type === "nexus" && mod.domainName === SKYRIM_DOMAIN;

export const isCommunityShaders = (mod: ICollectionMod) =>
  isNexus(mod) && mod.source.modId === CS_MOD_ID;

export function removalReason(mod: ICollectionMod): RemovedReason | undefined {
  if (!isNexus(mod)) return undefined;
  if (mod.source.modId !== undefined && CS_FEATURE_MODS[mod.source.modId] !== undefined) {
    return "feature";
  }
  if (INCOMPATIBLE_NAMES.test(mod.name)) return "incompatible";
  return CS_FEATURE_NAMES.test(mod.name.trim()) ? "feature" : undefined;
}

/** une référence de règle vise-t-elle ce membre de la collection ? */
function refersTo(ref: IModReference, entry: ICollectionMod): boolean {
  const { source } = entry;
  if (ref.tag !== undefined && ref.tag === source.tag) return true;
  if (source.modId !== undefined && ref.repo?.modId !== undefined) {
    return String(ref.repo.modId) === String(source.modId);
  }
  if (ref.fileMD5 !== undefined && ref.fileMD5 === source.md5) return true;
  if (ref.logicalFileName !== undefined && ref.logicalFileName === source.logicalFilename) {
    return true;
  }
  return ref.fileExpression !== undefined && ref.fileExpression === source.fileExpression;
}

/** la référence qui désigne le membre Bottled dans les règles de la collection */
function bottledReference(bottled: ISubstitution["bottled"]): IModReference {
  return {
    tag: bottled.tag,
    description: bottled.name,
    versionMatch: "*",
    repo: {
      repository: "nexus",
      gameId: SKYRIM_DOMAIN,
      modId: String(bottled.modId),
      fileId: String(bottled.fileId),
    },
  } as IModReference;
}

/** le membre de la collection qui installe Bottled Shaders, à la place de Community Shaders */
export function bottledEntry(
  bottled: ISubstitution["bottled"],
  cs: ICollectionMod,
): ICollectionMod {
  return {
    name: bottled.name,
    version: bottled.version,
    optional: cs.optional,
    domainName: SKYRIM_DOMAIN,
    author: "Bottle",
    phase: cs.phase,
    details: cs.details,
    source: {
      type: "nexus",
      modId: bottled.modId,
      fileId: bottled.fileId,
      updatePolicy: "latest",
      tag: bottled.tag,
    },
  };
}

/**
 * Remplace Community Shaders par Bottled Shaders dans la collection, écarte les modules intégrés et
 * Dynamic Terrain Deformation. undefined si la collection n'apporte pas Community Shaders.
 */
export function substituteCollection(
  collection: ICollection,
  bottledFile: IBottledFile,
): ICollection | undefined {
  const csIndex = (collection.mods ?? []).findIndex(isCommunityShaders);
  if (csIndex < 0) return undefined;
  const cs = collection.mods[csIndex];

  const bottled: ISubstitution["bottled"] = {
    ...bottledFile,
    modId: BOTTLED_MOD_ID,
    name: BOTTLED_NAME,
    tag: BOTTLED_TAG,
  };

  const removed: IRemovedMod[] = [];
  const removedEntries: ICollectionMod[] = [];
  const mods: ICollectionMod[] = [];
  collection.mods.forEach((mod, index) => {
    if (index === csIndex) {
      mods.push(bottledEntry(bottled, cs));
      return;
    }
    const reason = removalReason(mod);
    if (reason === undefined) {
      mods.push(mod);
    } else {
      removed.push({ name: mod.name, modId: mod.source.modId, reason });
      removedEntries.push(mod);
    }
  });

  const modRules: ICollectionModRule[] = [];
  const toBottled = bottledReference(bottled);
  for (const rule of collection.modRules ?? []) {
    // une règle vers un mod écarté n'a plus d'objet (elle ne ferait qu'en réclamer le téléchargement)
    if (
      removedEntries.some(
        (entry) => refersTo(rule.source, entry) || refersTo(rule.reference, entry),
      )
    ) {
      continue;
    }
    const sourceIsCs = refersTo(rule.source, cs);
    const referenceIsCs = refersTo(rule.reference, cs);
    if (sourceIsCs && referenceIsCs) continue;
    modRules.push({
      ...rule,
      source: sourceIsCs ? toBottled : rule.source,
      reference: referenceIsCs ? toBottled : rule.reference,
    });
  }

  return {
    ...collection,
    mods,
    modRules,
    mortexSubstitution: {
      bottled,
      replaced: { name: cs.name, version: cs.version, modId: CS_MOD_ID },
      removed,
    },
  };
}

/** le plus récent des fichiers principaux d'un mod Nexus */
export function latestMainFile(
  files: Array<{
    file_id: number;
    version?: string;
    category_id?: number;
    category_name?: string;
    uploaded_timestamp?: number;
    is_primary?: boolean;
  }>,
): IBottledFile | undefined {
  const main = (files ?? []).filter(
    (file) => file.category_id === 1 || file.category_name?.toUpperCase() === "MAIN",
  );
  const best = [...main].sort(
    (lhs, rhs) =>
      (rhs.uploaded_timestamp ?? 0) - (lhs.uploaded_timestamp ?? 0) ||
      Number(rhs.is_primary === true) - Number(lhs.is_primary === true),
  )[0];
  return best === undefined ? undefined : { fileId: best.file_id, version: best.version ?? "" };
}

const NEXUS_TIMEOUT_MS = 15000;

/** réponse de Nexus gardée pour la session : une collection est lue plusieurs fois */
let bottledFile: IBottledFile | undefined;
let bottledPending: Promise<IBottledFile | undefined> | undefined;

/** pour les tests */
export function resetBottledCache() {
  bottledFile = undefined;
  bottledPending = undefined;
  warnedUnavailable = false;
}

/** undefined sans réponse de Nexus (hors ligne, compte non connecté) : jamais d'estimation */
export function latestBottledFile(api: IExtensionApi): Promise<IBottledFile | undefined> {
  if (bottledFile !== undefined) return Promise.resolve(bottledFile);
  bottledPending ??= (async () => {
    try {
      const answer = await Promise.race([
        api.emitAndAwait("get-mod-files", SKYRIM_GAME, BOTTLED_MOD_ID),
        new Promise<undefined>((resolve) => setTimeout(resolve, NEXUS_TIMEOUT_MS)),
      ]);
      const files = Array.isArray(answer) ? answer[0] : undefined;
      bottledFile = Array.isArray(files) ? latestMainFile(files) : undefined;
    } catch (err) {
      log("warn", "could not look up Bottled Shaders on Nexus", {
        error: getErrorMessageOrDefault(err),
      });
    }
    bottledPending = undefined;
    return bottledFile;
  })();
  return bottledPending;
}

let warnedUnavailable = false;

function warnUnavailable(api: IExtensionApi) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  api.sendNotification({
    id: "mortex-bottled-unavailable",
    type: "warning",
    title: "Bottled Shaders could not be looked up",
    message:
      "This collection brings the stock Community Shaders, which doesn't work on a Mac. " +
      "mORTEX couldn't reach Nexus Mods to replace it with Bottled Shaders, so nothing was changed. " +
      "Check that you are logged in to Nexus Mods, then use the DXMT workshop to replace it.",
  });
}

/** réglages de l'extension (reducers/settings), pas encore dans le type de l'état */
export function collectionsSettings(api: IExtensionApi): {
  macRenderSubstitution?: boolean;
  bottledSettingsChoice?: string;
} {
  return (api.getState().settings as any).collections ?? {};
}

export function substitutionEnabled(api: IExtensionApi): boolean {
  return process.platform === "darwin" && collectionsSettings(api).macRenderSubstitution !== false;
}

/**
 * Le mod de collection que ce collection.json décrit, quand il est déjà installé (dossier de
 * préparation du mod, ou dossier temporaire d'une mise à jour).
 */
export function collectionModFor(api: IExtensionApi, manifest: string): IMod | undefined {
  const state = api.getState();
  const mods: Record<string, IMod> = state.persistent.mods[activeGameId(state)] ?? {};
  const folder = path.basename(path.dirname(manifest));
  const updated = folder.match(/^collection-update-(.+)$/)?.[1];
  if (updated !== undefined) return mods[updated];
  return Object.values(mods).find(
    (mod) => mod.type === MOD_TYPE && mod.installationPath === folder,
  );
}

/**
 * Point d'entrée de readCollection. Remplace Community Shaders par Bottled si le réglage est
 * actif, sur le Mac, pour Skyrim SE, et si ce n'est pas désactivé pour cette collection. Sans
 * réponse de Nexus, la collection reste telle quelle (jamais un Bottled introuvable à la place) et
 * une notification le dit.
 */
export async function substituteRenderMods(
  api: IExtensionApi,
  collection: ICollection,
  manifest?: string,
): Promise<ICollection | undefined> {
  if (!substitutionEnabled(api)) return undefined;
  if (!(collection.mods ?? []).some(isCommunityShaders)) return undefined;
  if (manifest !== undefined) {
    const mod = collectionModFor(api, manifest);
    if (mod?.attributes?.[ATTR_SUBSTITUTION_OFF] === true) return undefined;
  }
  const bottled = await latestBottledFile(api);
  if (bottled === undefined) {
    warnUnavailable(api);
    return undefined;
  }
  return substituteCollection(collection, bottled);
}
