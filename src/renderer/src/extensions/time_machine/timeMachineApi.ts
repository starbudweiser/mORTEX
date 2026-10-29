/**
 * mORTEX (macOS) : la machine à remonter le temps branchée sur l'état de mORTEX
 * (util/macos/timeMachine pour les fichiers).
 *
 *  - timeMachineContext(api)   où sont Data, la préparation, la config et les instantanés du jeu actif
 *  - takeSnapshot(api, reason)   instantané du jeu et du profil actifs, puis tri façon Time Machine
 *  - restoreSnapshot(api, snapshot)        instantané de sécurité, purge, fichiers, état des mods, déploiement
 *  - previousSnapshots(api)   instantanés existants du jeu actif (vide sans Time Machine)
 *  - replaceSnapshots(api, previous)   nouvel instantané de l'état actuel, puis suppression des
 *    précédents : après un retrait de mods, ce sont eux qui gardent les fichiers sur le disque
 *
 * Les instantanés vivent dans la bouteille du jeu (<bouteille>/mortex-time-machine/<jeu>), sur le
 * même volume APFS que Data et la préparation, condition des clones.
 */
import * as path from "node:path";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { bottleForPath } from "../../util/macos/bottles";
import {
  canClone,
  createSnapshot,
  deleteSnapshot,
  type ISnapshot,
  listSnapshots,
  restoreFiles,
  snapshotsToPrune,
} from "../../util/macos/timeMachine";
import { batchDispatch } from "../../util/util";
import { gameDataPath, pluginPath } from "../gamebryo_plugin_management/util/gameSupport";
import { discoveryByGame } from "../gamemode_management/selectors";
import { getGame } from "../gamemode_management/util/getGame";
import { iniFiles } from "../ini_prep/gameSupport";
import { addMods, removeMod } from "../mod_management/actions/mods";
import { installPathForGame } from "../mod_management/selectors";
import { getManifest } from "../mod_management/util/activationStore";
import { setModEnabled } from "../profile_management/actions/profiles";
import { activeGameId, activeProfile } from "../profile_management/selectors";

/** évènement émis quand la liste des instantanés change */
export const CHANGED_EVENT = "time-machine-changed";

export interface ITimeMachineContext {
  root: string;
  gameId: string;
  dataPath: string;
  stagingPath: string;
  configFiles: string[];
}

export function timeMachineContext(api: IExtensionApi): ITimeMachineContext | undefined {
  const state: IState = api.getState();
  const gameId = activeGameId(state);
  const discovery = discoveryByGame(state, gameId);
  if (gameId === undefined || discovery?.path === undefined) return undefined;
  const bottle = bottleForPath(discovery.path);
  const stagingPath = installPathForGame(state, gameId);
  if (bottle === undefined || stagingPath === undefined) return undefined;

  let dataPath = path.join(discovery.path, "Data");
  const configFiles: string[] = [];
  try {
    dataPath = gameDataPath(gameId);
    const plugins = pluginPath(gameId);
    configFiles.push(path.join(plugins, "plugins.txt"), path.join(plugins, "loadorder.txt"));
  } catch {
    // jeu sans plugins à la Bethesda
  }
  try {
    configFiles.push(...iniFiles(gameId, discovery));
  } catch {
    // jeu sans INI connus
  }
  return {
    root: path.join(bottle.path, "mortex-time-machine", gameId),
    gameId,
    dataPath,
    stagingPath,
    configFiles,
  };
}

export async function isAvailable(context: ITimeMachineContext): Promise<boolean> {
  // la bouteille : le dossier des instantanés n'existe qu'après le premier
  return canClone([context.dataPath, context.stagingPath, path.resolve(context.root, "../..")]);
}

/**
 * Fichiers de Data déployés par mORTEX, tous types de mods confondus : certains visent la racine
 * du jeu (SKSE y dépose « Data/Scripts/… »).
 */
async function deployedInData(api: IExtensionApi, context: ITimeMachineContext): Promise<string[]> {
  const game = getGame(context.gameId);
  const typeIds = ["", ...(game?.modTypes ?? []).map((type) => type.typeId)];
  const result = new Set<string>();
  for (const typeId of typeIds) {
    const manifest = await getManifest(api, typeId, context.gameId);
    const target =
      manifest.targetPath ??
      (typeId === ""
        ? context.dataPath
        : game?.modTypes?.find((type) => type.typeId === typeId)?.getPath(game));
    if (target === undefined) continue;
    for (const file of manifest.files) {
      const rel = path.relative(context.dataPath, path.join(target, file.relPath));
      if (!rel.startsWith("..") && !path.isAbsolute(rel)) result.add(rel);
    }
  }
  return [...result];
}

export async function takeSnapshot(
  api: IExtensionApi,
  reason: ISnapshot["reason"],
): Promise<ISnapshot | undefined> {
  const context = timeMachineContext(api);
  const state: IState = api.getState();
  const profile = activeProfile(state);
  if (context === undefined || profile === undefined || !(await isAvailable(context))) {
    return undefined;
  }
  const deployed = await deployedInData(api, context);
  const modState = Object.fromEntries(
    Object.entries(profile.modState ?? {}).map(([id, value]) => [
      id,
      { enabled: value.enabled === true },
    ]),
  );
  const started = Date.now();
  const snapshot = await createSnapshot(context.root, {
    reason,
    gameId: context.gameId,
    profileId: profile.id,
    profileName: profile.name,
    managed: deployed,
    mods: state.persistent.mods[context.gameId] ?? {},
    modState,
    dataPath: context.dataPath,
    stagingPath: context.stagingPath,
    configFiles: context.configFiles,
  });
  log("info", "time machine snapshot", { id: snapshot.id, reason, ms: Date.now() - started });

  const now = Date.now();
  for (const old of snapshotsToPrune(await listSnapshots(context.root), now)) {
    await deleteSnapshot(context.root, old.id).catch((err) =>
      log("warn", "failed to prune snapshot", { id: old.id, error: (err as Error).message }),
    );
  }
  api.events.emit(CHANGED_EVENT);
  return snapshot;
}

type Callback = (err: Error | null) => void;
const asPromise = (start: (callback: Callback) => void) =>
  new Promise<void>((resolve, reject) => start((err) => (err ? reject(err) : resolve())));

let restoring = false;

/** une restauration est en cours : ses propres déploiements ne prennent pas d'instantané */
export const isRestoring = () => restoring;

export async function restoreSnapshot(api: IExtensionApi, snapshot: ISnapshot): Promise<void> {
  const context = timeMachineContext(api);
  if (context === undefined || context.gameId !== snapshot.gameId) {
    throw new Error("The snapshot belongs to another game");
  }
  if (activeProfile(api.getState())?.id !== snapshot.profileId) {
    throw new Error("Switch to the snapshot's profile first");
  }
  restoring = true;
  try {
    await takeSnapshot(api, "restore");
    await asPromise((callback) => api.events.emit("purge-mods", false, callback));
    await restoreFiles(context.root, snapshot, {
      dataPath: context.dataPath,
      stagingPath: context.stagingPath,
    });

    const current = api.getState().persistent.mods[snapshot.gameId] ?? {};
    batchDispatch(api.store, [
      ...Object.keys(current)
        .filter((id) => snapshot.mods[id] === undefined)
        .map((id) => removeMod(snapshot.gameId, id)),
      addMods(snapshot.gameId, Object.values(snapshot.mods) as never[]),
      ...Object.keys(snapshot.mods).map((id) =>
        setModEnabled(snapshot.profileId, id, snapshot.modState[id]?.enabled === true),
      ),
    ]);

    await asPromise((callback) =>
      api.events.emit("deploy-mods", callback, undefined, undefined, { manual: true }),
    );
    // LOOT a pu trier pendant que Data était vide : son alerte serait périmée, on retrie
    api.dismissNotification?.("loot-failed");
    api.events.emit("autosort-plugins", true, () => undefined);
    log("info", "time machine restored", { id: snapshot.id });
  } finally {
    restoring = false;
    api.events.emit(CHANGED_EVENT);
  }
}

export async function previousSnapshots(api: IExtensionApi): Promise<ISnapshot[]> {
  const context = timeMachineContext(api);
  if (context === undefined) return [];
  return listSnapshots(context.root).catch(() => []);
}

export async function replaceSnapshots(api: IExtensionApi, previous: ISnapshot[]): Promise<number> {
  const context = timeMachineContext(api);
  if (context === undefined || previous.length === 0) return 0;
  // l'état actuel d'abord : la Time Machine n'est jamais vide
  if ((await takeSnapshot(api, "manual")) === undefined) return 0;
  let deleted = 0;
  for (const snapshot of previous) {
    try {
      await deleteSnapshot(context.root, snapshot.id);
      ++deleted;
    } catch (err) {
      // déjà retiré par le tri qui suit chaque instantané
      log("info", "snapshot not deleted", { id: snapshot.id, error: (err as Error).message });
    }
  }
  api.events.emit(CHANGED_EVENT);
  return deleted;
}

/** id de la case des boîtes de retrait de mods */
export const DELETE_SNAPSHOTS = "delete_snapshots";

/** case des boîtes de retrait de mods, cochée ; absente s'il n'y a pas d'instantané */
export function deleteSnapshotsCheckbox(api: IExtensionApi, previous: ISnapshot[]) {
  return previous.length === 0
    ? []
    : [
        {
          id: DELETE_SNAPSHOTS,
          text: api.translate(
            "Also delete the {{count}} previous Time Machine snapshots: they keep the files of removed mods, so the disk space is not freed (a new snapshot of the current state is taken)",
            { ns: "common", count: previous.length, replace: { count: previous.length } },
          ),
          value: true,
        },
      ];
}

/** après le retrait, si la case était cochée */
export async function deleteSnapshotsAfterRemoval(
  api: IExtensionApi,
  previous: ISnapshot[],
  checked: boolean | undefined,
): Promise<void> {
  if (checked !== true || previous.length === 0) return;
  try {
    const deleted = await replaceSnapshots(api, previous);
    if (deleted > 0) {
      api.sendNotification({
        id: "time-machine-snapshots-deleted",
        type: "success",
        message:
          deleted === 1
            ? "Previous snapshot deleted, the space of the removed mods is freed"
            : "{{count}} previous snapshots deleted, the space of the removed mods is freed",
        replace: { count: deleted },
        displayMS: 5000,
      });
    }
  } catch (err) {
    api.showErrorNotification?.("Failed to delete the previous snapshots", err as Error, {
      allowReport: false,
    });
  }
}
