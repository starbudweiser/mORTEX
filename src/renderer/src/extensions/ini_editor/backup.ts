/**
 * mORTEX (macOS) : copies de sécurité des INI avant chaque enregistrement de l'Éditeur de réglages.
 * Chaque copie est un dossier « AAAA-MM-JJ HH.MM.SS » dans « mORTEX Backups », à côté des INI, avec un
 * manifeste qui dit d'où vient chaque fichier : la restauration (Annuler, ou la liste des sauvegardes)
 * remet chaque fichier à sa place et supprime ceux que l'enregistrement avait créés.
 */
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

export const BACKUPS_DIRNAME = "mORTEX Backups";
const MANIFEST = "manifest.json";

interface IManifest {
  version: 1;
  /** fichiers copiés : nom dans la sauvegarde → chemin d'origine */
  files: Array<{ name: string; path: string }>;
  /** fichiers qui n'existaient pas avant l'enregistrement (supprimés à la restauration) */
  created: string[];
}

export interface IBackup {
  /** dossier de la sauvegarde */
  dir: string;
  /** « 2026-10-29 21.15.03 » */
  name: string;
  files: string[];
}

const two = (n: number) => String(n).padStart(2, "0");

export const backupName = (date: Date) =>
  `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
  `${two(date.getHours())}.${two(date.getMinutes())}.${two(date.getSeconds())}`;

const exists = (file: string) =>
  readFile(file).then(
    () => true,
    () => false,
  );

/**
 * Copie les fichiers existants avant de les modifier. `toCreate` : fichiers que l'enregistrement va
 * créer, notés pour que la restauration les supprime.
 */
export async function createBackup(
  files: readonly string[],
  toCreate: readonly string[] = [],
  now: Date = new Date(),
): Promise<IBackup> {
  const all = [...files, ...toCreate];
  if (all.length === 0) throw new Error("Rien à sauvegarder");
  const root = path.join(path.dirname(all[0]), BACKUPS_DIRNAME);
  const base = backupName(now);
  let dir = path.join(root, base);
  for (let n = 2; await exists(path.join(dir, MANIFEST)); n++)
    dir = path.join(root, `${base} (${n})`);
  await mkdir(dir, { recursive: true });

  const manifest: IManifest = { version: 1, files: [], created: [...toCreate] };
  for (const file of files) {
    const name = path.basename(file);
    await copyFile(file, path.join(dir, name));
    manifest.files.push({ name, path: file });
  }
  await writeFile(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2));
  return { dir, name: path.basename(dir), files: manifest.files.map((f) => f.name) };
}

/**
 * Remet les fichiers de la sauvegarde à leur place (en écrivant dans le fichier existant : les liens
 * du dossier de préparation sont suivis) et supprime ceux que l'enregistrement avait créés.
 */
export async function restoreBackup(dir: string): Promise<string[]> {
  const manifest = JSON.parse(await readFile(path.join(dir, MANIFEST), "utf8")) as IManifest;
  const restored: string[] = [];
  for (const file of manifest.files) {
    await writeFile(file.path, await readFile(path.join(dir, file.name)));
    restored.push(file.path);
  }
  for (const file of manifest.created) {
    await rm(file, { force: true });
    restored.push(file);
  }
  return restored;
}

/** les sauvegardes d'un dossier d'INI, de la plus récente à la plus ancienne */
export async function listBackups(iniDir: string): Promise<IBackup[]> {
  const root = path.join(iniDir, BACKUPS_DIRNAME);
  const names = await readdir(root).catch(() => [] as string[]);
  const backups: IBackup[] = [];
  for (const name of names) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(root, name, MANIFEST), "utf8"),
      ) as IManifest;
      backups.push({ dir: path.join(root, name), name, files: manifest.files.map((f) => f.name) });
    } catch {
      // dossier étranger : ignoré
    }
  }
  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Restaure une sauvegarde après avoir copié l'état actuel de ses fichiers dans une nouvelle
 * sauvegarde : la restauration elle-même peut ainsi s'annuler. Retourne cette nouvelle sauvegarde.
 */
export async function restoreBackupSafely(dir: string): Promise<IBackup> {
  const manifest = JSON.parse(await readFile(path.join(dir, MANIFEST), "utf8")) as IManifest;
  const present: string[] = [];
  const missing: string[] = [];
  for (const file of manifest.files)
    ((await exists(file.path)) ? present : missing).push(file.path);
  const safety = await createBackup(present, missing);
  await restoreBackup(dir);
  return safety;
}
