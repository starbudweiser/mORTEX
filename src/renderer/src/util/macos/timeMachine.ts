/**
 * mORTEX (macOS) : machine à remonter le temps du modding. Un instantané clone en APFS (copie à
 * coût quasi nul, `cp -c`) le dossier Data, le dossier de préparation des mods et les fichiers de
 * configuration (INI, plugins.txt, loadorder.txt) ; l'état des mods est noté à côté.
 *
 * Interface :
 *  - canClone(paths): Promise<boolean>                    tous sur un même volume APFS
 *  - createSnapshot(root, input): Promise<ISnapshot>      <root>/<id>/{Data,staging,config,snapshot.json}
 *  - listSnapshots(root): Promise<ISnapshot[]>            du plus récent au plus ancien
 *  - snapshotsToPrune(snapshots, now): ISnapshot[]        façon Time Machine (voir KEEP_ALL_MS)
 *  - deleteSnapshot(root, id)
 *  - restoreFiles(root, snapshot, targets)                remet Data, la préparation et la config
 *
 * Les fichiers que mORTEX déploie (liens vers la préparation) sont clonés avec Data mais notés
 * dans `managed` : à la restauration ils sont retirés, le déploiement qui suit les recrée.
 * Ce qui est remplacé à la restauration part dans <root>/.trash, vidé ensuite.
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import * as path from "node:path";

/** tous les instantanés des dernières 24 h, puis le plus récent de chaque jour sur 14 jours */
export const KEEP_ALL_MS = 24 * 3600 * 1000;
export const KEEP_DAYS = 14;

/** signature de APFS dans statfs (f_type) */
const APFS_TYPE = 0x1a;

export interface ISnapshotConfigFile {
  /** chemin d'origine */
  path: string;
  /** nom dans config/ */
  stored: string;
}

export interface ISnapshot {
  id: string;
  created: number;
  reason: "deploy" | "manual" | "restore";
  gameId: string;
  profileId: string;
  profileName: string;
  /** chemins relatifs à Data des fichiers déployés par mORTEX au moment de l'instantané */
  managed: string[];
  config: ISnapshotConfigFile[];
  /** état des mods (IMod par id) et de leur activation dans le profil */
  mods: Record<string, unknown>;
  modState: Record<string, { enabled: boolean }>;
  modCount: number;
  enabledCount: number;
}

export interface ISnapshotInput extends Omit<
  ISnapshot,
  "id" | "created" | "config" | "modCount" | "enabledCount"
> {
  dataPath: string;
  stagingPath: string;
  configFiles: string[];
  now?: number;
}

export interface IRestoreTargets {
  dataPath: string;
  stagingPath: string;
}

const cp = (args: string[]) =>
  new Promise<void>((resolve, reject) =>
    execFile("/bin/cp", args, { maxBuffer: 16 * 1024 * 1024 }, (err, _out, stderr) =>
      err ? reject(new Error(`cp ${args[0]}: ${stderr || err.message}`)) : resolve(),
    ),
  );

/** clone un fichier, ou le copie s'il est sur un autre volume (INI hors de la bouteille) */
const cloneFile = (src: string, dst: string) =>
  cp(["-cp", src, dst]).catch(() => cp(["-p", src, dst]));

/** clone le contenu de `src` dans `dst` (créé au besoin) */
async function cloneContents(src: string, dst: string): Promise<void> {
  await mkdir(dst, { recursive: true });
  const entries = await readdir(src).catch(() => [] as string[]);
  if (entries.length === 0) return;
  // « src/. » copie le contenu sans recréer le dossier lui-même
  await cp(["-cRp", `${src}/.`, dst]);
}

export async function canClone(paths: string[]): Promise<boolean> {
  try {
    const stats = await Promise.all(paths.map((p) => stat(p)));
    if (new Set(stats.map((s) => s.dev)).size !== 1) return false;
    return (await statfs(paths[0])).type === APFS_TYPE;
  } catch {
    return false;
  }
}

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

function snapshotId(now: number): string {
  return new Date(now).toISOString().replace(/[:.]/g, "-");
}

export async function createSnapshot(root: string, input: ISnapshotInput): Promise<ISnapshot> {
  const created = input.now ?? Date.now();
  const id = snapshotId(created);
  const dir = path.join(root, id);
  const partial = `${dir}.partial`;
  await rm(partial, { recursive: true, force: true });
  await mkdir(path.join(partial, "config"), { recursive: true });

  await cloneContents(input.dataPath, path.join(partial, "Data"));
  await cloneContents(input.stagingPath, path.join(partial, "staging"));
  const config: ISnapshotConfigFile[] = [];
  for (const [idx, file] of input.configFiles.entries()) {
    if (!(await exists(file))) continue;
    const stored = `${idx}-${path.basename(file)}`;
    await cloneFile(file, path.join(partial, "config", stored));
    config.push({ path: file, stored });
  }

  const enabledCount = Object.values(input.modState).filter((state) => state.enabled).length;
  const snapshot: ISnapshot = {
    id,
    created,
    reason: input.reason,
    gameId: input.gameId,
    profileId: input.profileId,
    profileName: input.profileName,
    managed: input.managed,
    config,
    mods: input.mods,
    modState: input.modState,
    modCount: Object.keys(input.mods).length,
    enabledCount,
  };
  await writeFile(path.join(partial, "snapshot.json"), JSON.stringify(snapshot));
  // n'apparaît dans la liste qu'une fois complet
  await rename(partial, dir);
  return snapshot;
}

export async function listSnapshots(root: string): Promise<ISnapshot[]> {
  const entries = await readdir(root).catch(() => [] as string[]);
  const snapshots = await Promise.all(
    entries
      .filter((entry) => !entry.startsWith(".") && !entry.endsWith(".partial"))
      .map((entry) =>
        readFile(path.join(root, entry, "snapshot.json"), "utf8")
          .then((text) => JSON.parse(text) as ISnapshot)
          .catch(() => undefined),
      ),
  );
  return snapshots
    .filter((snapshot): snapshot is ISnapshot => snapshot !== undefined)
    .sort((lhs, rhs) => rhs.created - lhs.created);
}

/** jour civil local, pour garder un instantané par jour */
const dayOf = (time: number) => new Date(time).toDateString();

export function snapshotsToPrune(snapshots: ISnapshot[], now: number): ISnapshot[] {
  const keptDays = new Set<string>();
  const oldest = now - KEEP_DAYS * 24 * 3600 * 1000;
  // du plus récent au plus ancien : le premier vu d'un jour est le plus récent de ce jour
  return [...snapshots]
    .sort((lhs, rhs) => rhs.created - lhs.created)
    .filter((snapshot) => {
      if (now - snapshot.created < KEEP_ALL_MS) return false;
      if (snapshot.created < oldest) return true;
      const day = dayOf(snapshot.created);
      if (keptDays.has(day)) return true;
      keptDays.add(day);
      return false;
    });
}

export async function deleteSnapshot(root: string, id: string): Promise<void> {
  // renommé d'abord : il disparaît de la liste tout de suite, l'effacement peut prendre du temps
  const trash = path.join(root, ".trash", `${id}-${Date.now()}`);
  await mkdir(path.dirname(trash), { recursive: true });
  await rename(path.join(root, id), trash);
  await rm(trash, { recursive: true, force: true });
}

/** remplace le contenu de `target` par celui de `source`, l'ancien partant dans `trash` */
async function replaceContents(source: string, target: string, trash: string): Promise<void> {
  await mkdir(trash, { recursive: true });
  for (const entry of await readdir(target).catch(() => [] as string[])) {
    await rename(path.join(target, entry), path.join(trash, entry));
  }
  await cloneContents(source, target);
}

/**
 * Remet les fichiers de l'instantané. À appeler après une purge : Data ne contient alors plus
 * que des fichiers non déployés par mORTEX.
 */
export async function restoreFiles(
  root: string,
  snapshot: ISnapshot,
  targets: IRestoreTargets,
): Promise<void> {
  const dir = path.join(root, snapshot.id);
  const trash = path.join(root, ".trash", `restore-${Date.now()}`);

  await replaceContents(
    path.join(dir, "staging"),
    targets.stagingPath,
    path.join(trash, "staging"),
  );
  await replaceContents(path.join(dir, "Data"), targets.dataPath, path.join(trash, "Data"));
  // les fichiers déployés à l'époque : le déploiement qui suit les recrée en liens
  await Promise.all(
    snapshot.managed.map((relPath) => rm(path.join(targets.dataPath, relPath), { force: true })),
  );
  for (const file of snapshot.config) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await rm(file.path, { force: true });
    await cloneFile(path.join(dir, "config", file.stored), file.path);
  }
  await rm(trash, { recursive: true, force: true });
}
