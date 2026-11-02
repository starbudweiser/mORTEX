/**
 * mORTEX (macOS) : passer une collection déjà ajoutée de Bottled Shaders au Community Shaders de
 * l'auteur, et inversement. On échange les règles du mod de collection (celles que makeInstall a
 * créées à partir de collection.json) ; le collection.json de l'auteur n'est jamais modifié.
 *
 *  - useStockCommunityShaders : « Revenir au Community Shaders de la collection »
 *  - useBottledShaders        : « Remplacer par Bottled Shaders »
 *
 * Aucun mod n'est téléchargé ni activé ici : le dialogue de départ le fera en installant, l'Atelier
 * DXMT relance l'installation de la collection (`resume-collection`) et active ce qui doit l'être.
 */
import * as path from "path";

import * as actions from "../../../actions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import * as selectors from "../../../util/selectors";
import { batchDispatch } from "../../../util/util";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import testModReference from "../../mod_management/util/testModReference";
import { MOD_TYPE } from "../constants";
import type { ICollection, ICollectionMod } from "../types/ICollection";
import { REFERENCE_TAG_SCHEME } from "./deterministicReferenceTag";
import {
  ATTR_SUBSTITUTION,
  ATTR_SUBSTITUTION_OFF,
  BOTTLED_TAG,
  CS_MOD_ID,
  type ISubstitution,
  isCommunityShaders,
  latestBottledFile,
  removalReason,
  substituteCollection,
} from "./macRenderSubstitution";
import { readCollection } from "./readCollection";
import { collectionModToRule } from "./transformCollection";

export interface ISwapOutcome {
  /** les mods dont la collection ne parle plus ou parle de nouveau */
  collection: IMod;
  trace: ISubstitution | undefined;
}

function collectionModOf(api: IExtensionApi, gameId: string, modId: string): IMod {
  const mod: IMod | undefined = api.getState().persistent.mods[gameId]?.[modId];
  if (mod === undefined || mod.type !== MOD_TYPE || mod.installationPath === undefined) {
    throw new Error(`Collection ${modId} not found`);
  }
  return mod;
}

/** collection.json de l'auteur, sans Bottled à la place de Community Shaders */
async function readOriginal(api: IExtensionApi, gameId: string, mod: IMod): Promise<ICollection> {
  const staging = selectors.installPathForGame(api.getState(), gameId);
  return readCollection(api, path.join(staging, mod.installationPath, "collection.json"), {
    substitute: false,
  });
}

const rulesFor = (api: IExtensionApi, collection: ICollection, mods: ICollectionMod[]) => {
  const knownGames = selectors.knownGames(api.getState());
  const deterministic = collection.collectionConfig?.referenceTagScheme === REFERENCE_TAG_SCHEME;
  return mods.map((mod) => collectionModToRule(knownGames, mod, deterministic));
};

/** les règles de dépendance du mod de collection qui visent l'un de ces mods Nexus */
const rulesOfNexusMods = (mod: IMod, modIds: Set<number>): IModRule[] =>
  (mod.rules ?? []).filter(
    (rule) =>
      rule.reference.repo?.repository === "nexus" && modIds.has(Number(rule.reference.repo.modId)),
  );

const swapRules = (
  api: IExtensionApi,
  gameId: string,
  mod: IMod,
  remove: IModRule[],
  add: IModRule[],
) => {
  batchDispatch(api.store, [
    ...remove.map((rule) => actions.removeModRule(gameId, mod.id, rule)),
    ...add.map((rule) => actions.addModRule(gameId, mod.id, rule)),
  ]);
};

/** « Revenir au Community Shaders de la collection » */
export async function useStockCommunityShaders(
  api: IExtensionApi,
  gameId: string,
  collectionModId: string,
): Promise<void> {
  const mod = collectionModOf(api, gameId, collectionModId);
  const original = await readOriginal(api, gameId, mod);
  const wanted = original.mods.filter((entry) => isCommunityShaders(entry) || removalReason(entry));
  const present = new Set(
    (mod.rules ?? []).map((rule) => Number(rule.reference.repo?.modId)).filter((id) => id > 0),
  );
  swapRules(
    api,
    gameId,
    mod,
    (mod.rules ?? []).filter((rule) => rule.reference.tag === BOTTLED_TAG),
    rulesFor(
      api,
      original,
      wanted.filter((entry) => !present.has(entry.source.modId ?? 0)),
    ),
  );
  api.store.dispatch(actions.setModAttribute(gameId, mod.id, ATTR_SUBSTITUTION_OFF, true));
}

/** « Remplacer par Bottled Shaders » : undefined si la collection n'apporte pas Community Shaders */
export async function useBottledShaders(
  api: IExtensionApi,
  gameId: string,
  collectionModId: string,
): Promise<ISubstitution | undefined> {
  const mod = collectionModOf(api, gameId, collectionModId);
  const original = await readOriginal(api, gameId, mod);
  const bottled = await latestBottledFile(api);
  if (bottled === undefined) {
    throw new Error("Bottled Shaders could not be looked up on Nexus Mods");
  }
  const substituted = substituteCollection(original, bottled);
  const trace = substituted?.mortexSubstitution;
  if (substituted === undefined || trace === undefined) return undefined;

  const stock = new Set<number>([CS_MOD_ID, ...trace.removed.map((iter) => iter.modId ?? 0)]);
  const hasBottled = (mod.rules ?? []).some((rule) => rule.reference.tag === BOTTLED_TAG);
  swapRules(
    api,
    gameId,
    mod,
    rulesOfNexusMods(mod, stock),
    hasBottled
      ? []
      : rulesFor(
          api,
          substituted,
          substituted.mods.filter((entry) => entry.source.tag === BOTTLED_TAG),
        ),
  );
  api.store.dispatch(
    actions.setModAttributes(gameId, mod.id, {
      [ATTR_SUBSTITUTION]: trace,
      [ATTR_SUBSTITUTION_OFF]: false,
    }),
  );
  return trace;
}

/** les mods de collection installés qui apportent (ou ont apporté) Community Shaders */
export async function collectionsWithCommunityShaders(
  api: IExtensionApi,
  gameId: string,
): Promise<IMod[]> {
  const mods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
  const found: IMod[] = [];
  for (const mod of Object.values(mods)) {
    if (mod.type !== MOD_TYPE || mod.installationPath === undefined) continue;
    if (mod.attributes?.[ATTR_SUBSTITUTION] !== undefined) {
      found.push(mod);
      continue;
    }
    try {
      const original = await readOriginal(api, gameId, mod);
      if (original.mods.some(isCommunityShaders)) found.push(mod);
    } catch {
      // collection.json illisible : cette collection n'est pas concernée
    }
  }
  return found;
}

/**
 * Les collections installées ne réclament plus ces mods (désactivés parce que Bottled Shaders les
 * intègre ou les refuse) : sans cela, chaque collection qui les contient repasse « incomplète » et
 * propose de les réinstaller. Rend de quoi remettre les règles retirées.
 */
export function releaseFromCollections(
  api: IExtensionApi,
  gameId: string,
  modIds: string[],
): (() => void) & { removed: IReleasedRule[] } {
  const mods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
  const targets = modIds.map((id) => mods[id]).filter((mod) => mod !== undefined);
  const removed: IReleasedRule[] = [];
  for (const collection of Object.values(mods)) {
    if (collection.type !== MOD_TYPE) continue;
    for (const rule of collection.rules ?? []) {
      if (
        ["requires", "recommends"].includes(rule.type) &&
        targets.some((mod) => testModReference(mod, rule.reference))
      ) {
        removed.push({ collectionId: collection.id, rule });
      }
    }
  }
  batchDispatch(
    api.store,
    removed.map(({ collectionId, rule }) => actions.removeModRule(gameId, collectionId, rule)),
  );
  return Object.assign(() => restoreCollectionRules(api, gameId, removed), { removed });
}

export interface IReleasedRule {
  collectionId: string;
  rule: IModRule;
}

/** remet les règles que releaseFromCollections a retirées */
export function restoreCollectionRules(api: IExtensionApi, gameId: string, rules: IReleasedRule[]) {
  batchDispatch(
    api.store,
    rules.map(({ collectionId, rule }) => actions.addModRule(gameId, collectionId, rule)),
  );
}
