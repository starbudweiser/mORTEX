/**
 * mORTEX (macOS) : parcours de dossier avec numéro de lien (nlink) et identifiant (inode).
 *
 * Interface :
 *  - turbowalkLinks(path, onEntries, opts?)   même contrat que `turbowalk` avec `details: true`
 *                                             (linkCount, idStr), pour hardlink_activator.
 *
 * Pourquoi : turbowalk n'a de version native que sous Windows ; ailleurs il ne renvoie ni
 * `linkCount` ni `idStr`, et le retrait des liens physiques (purgeLinks) ne retrouvait alors
 * aucun fichier à supprimer. Sur Windows on délègue à turbowalk.
 */
import * as fsNode from "node:fs/promises";
import * as path from "node:path";

import PromiseBB from "bluebird";
import turbowalk from "turbowalk";
import type { IEntry, IWalkOptions } from "turbowalk";

const CONCURRENCY = 64;

async function walkDir(
  dir: string,
  onEntries: (entries: IEntry[]) => void,
  recurse: boolean,
  skipHidden: boolean,
): Promise<void> {
  let names: string[];
  try {
    names = await fsNode.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
  if (skipHidden) {
    names = names.filter((name) => !name.startsWith("."));
  }

  const entries: IEntry[] = [];
  const subDirs: string[] = [];
  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const stats = await Promise.all(
      names.slice(i, i + CONCURRENCY).map((name) =>
        fsNode.lstat(path.join(dir, name), { bigint: true }).then(
          (stat) => ({ name, stat }),
          () => undefined,
        ),
      ),
    );
    for (const item of stats) {
      if (item === undefined) {
        continue;
      }
      const { name, stat } = item;
      const filePath = path.join(dir, name);
      const isDirectory = stat.isDirectory();
      entries.push({
        filePath,
        isDirectory,
        isReparsePoint: stat.isSymbolicLink(),
        size: Number(stat.size),
        mtime: Number(stat.mtimeMs) / 1000,
        linkCount: Number(stat.nlink),
        idStr: stat.ino.toString(),
      } as IEntry);
      if (isDirectory) {
        subDirs.push(filePath);
      }
    }
  }

  if (entries.length > 0) {
    onEntries(entries);
  }
  if (recurse) {
    for (const subDir of subDirs) {
      await walkDir(subDir, onEntries, recurse, skipHidden);
    }
  }
}

export function turbowalkLinks(
  target: string,
  onEntries: (entries: IEntry[]) => void,
  options?: IWalkOptions,
): PromiseBB<void> {
  if (process.platform === "win32") {
    return turbowalk(target, onEntries, { ...options, details: true });
  }
  return PromiseBB.resolve(
    walkDir(target, onEntries, options?.recurse !== false, options?.skipHidden ?? true),
  );
}
