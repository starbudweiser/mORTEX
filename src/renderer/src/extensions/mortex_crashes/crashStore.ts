/**
 * mORTEX : état partagé des plantages sKYCRASH pour la carte d'Accueil et la fiche Mod. Un seul
 * sondage du main (`crashes:read`, toutes les 5 s tant qu'un composant est affiché) et un seul
 * calcul de rattachement, quel que soit le nombre de composants abonnés.
 */
import { useSyncExternalStore } from "react";

import { log } from "@/logging";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { getManifest } from "../mod_management/util/activationStore";
import { activeGameId } from "../profile_management/selectors";
import {
  buildFileIndex,
  linkEvent,
  sortNewestFirst,
  type FileIndex,
  type ILinkedEvent,
  type IModNames,
} from "./linking";

const POLL_MS = 5000;

export interface ICrashSnapshot {
  /** L'export de sKYCRASH existe. */
  available: boolean;
  skipped: number;
  /** Du plus récent au plus ancien. */
  events: ILinkedEvent[];
  files: FileIndex;
}

const EMPTY: ICrashSnapshot = { available: false, skipped: 0, events: [], files: new Map() };

let api: IExtensionApi | undefined;
let snapshot: ICrashSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

let revision: number | undefined;
let rawEvents: Parameters<typeof sortNewestFirst>[0] = [];
let available = false;
let skipped = 0;
let files: FileIndex = new Map();
let manifestKey: string | undefined;
let modsRef: unknown;
let busy = false;

export function setCrashApi(extensionApi: IExtensionApi): void {
  api = extensionApi;
}

function modNames(state: IState, gameId: string | undefined): IModNames[] {
  const mods = gameId === undefined ? undefined : state.persistent.mods?.[gameId];
  return Object.values(mods ?? {}).map((mod) => ({
    id: mod.id,
    names: [mod.attributes?.modName, mod.attributes?.name, mod.attributes?.logicalFileName].filter(
      (name): name is string => typeof name === "string",
    ),
  }));
}

async function refresh(): Promise<void> {
  if (api === undefined || busy) {
    return;
  }
  busy = true;
  try {
    const state = api.store.getState();
    const gameId = activeGameId(state);
    let changed = false;

    const result = await window.api.crashes.read(revision);
    if (result.revision !== revision || result.available !== available) {
      revision = result.revision;
      available = result.available;
      skipped = result.skipped;
      rawEvents = result.events ?? rawEvents;
      changed = true;
    }

    // Les fichiers déployés ne sont relus que si le déploiement ou le jeu a changé.
    const key = `${gameId}:${state.persistent.deployment?.deploymentCounter?.[gameId] ?? 0}`;
    if (gameId !== undefined && key !== manifestKey) {
      manifestKey = key;
      try {
        const manifest = await getManifest(api, undefined, gameId);
        files = buildFileIndex(manifest.files);
      } catch (err) {
        log("warn", "Crash analysis: could not read the deployment manifest", {
          error: (err as Error).message,
        });
        files = new Map();
      }
      changed = true;
    }

    const mods = state.persistent.mods?.[gameId];
    if (mods !== modsRef) {
      modsRef = mods;
      changed = true;
    }

    if (changed) {
      const names = modNames(state, gameId);
      snapshot = {
        available,
        skipped,
        files,
        events: sortNewestFirst(rawEvents).map((event) => linkEvent(event, files, names)),
      };
      listeners.forEach((listener) => listener());
    }
  } catch (err) {
    log("warn", "Crash analysis: reading the sKYCRASH export failed", {
      error: (err as Error).message,
    });
  } finally {
    busy = false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    void refresh();
    timer = setInterval(() => void refresh(), POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useCrashes(): ICrashSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
