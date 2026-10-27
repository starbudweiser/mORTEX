/**
 * mORTEX (macOS) : dédoublonnage par clones APFS. Les fichiers identiques entre mods (mêmes
 * textures dans deux versions d'un mod, packs qui se recoupent) deviennent des clones d'une seule
 * copie : même contenu, place prise une fois, et une modification ultérieure sépare les copies.
 *
 * Interface :
 *  - findDuplicates(root, minSize?): Promise<IDuplicates>   groupes de fichiers identiques
 *  - cloneDuplicates(groups): Promise<number>               octets regagnés
 *
 * Comparaison : taille, puis empreinte SHA-256 du contenu. Les fichiers déjà liés entre eux (même
 * inode) ne comptent qu'une fois.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, rename, rm, stat } from "node:fs/promises";
import * as path from "node:path";

export const MIN_SIZE = 64 * 1024;

export interface IDuplicates {
  /** fichiers identiques, le premier est gardé */
  groups: string[][];
  /** octets regagnables */
  savings: number;
  files: number;
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const hashOf = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

export async function findDuplicates(root: string, minSize = MIN_SIZE): Promise<IDuplicates> {
  // par taille d'abord : seules les tailles partagées valent une empreinte
  const bySize = new Map<number, string[]>();
  const seenInodes = new Set<string>();
  for await (const file of walk(root)) {
    const info = await stat(file).catch(() => undefined);
    if (info === undefined || info.size < minSize) continue;
    const inode = `${info.dev}:${info.ino}`;
    if (seenInodes.has(inode)) continue;
    seenInodes.add(inode);
    bySize.set(info.size, [...(bySize.get(info.size) ?? []), file]);
  }

  const groups: string[][] = [];
  let savings = 0;
  let files = 0;
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2) continue;
    const byHash = new Map<string, string[]>();
    for (const file of candidates) {
      const hash = await hashOf(file).catch(() => undefined);
      if (hash !== undefined) byHash.set(hash, [...(byHash.get(hash) ?? []), file]);
    }
    for (const group of byHash.values()) {
      if (group.length < 2) continue;
      groups.push(group.sort());
      savings += size * (group.length - 1);
      files += group.length - 1;
    }
  }
  return { groups, savings, files };
}

const cp = (args: string[]) =>
  new Promise<void>((resolve, reject) =>
    execFile("/bin/cp", args, (err, _out, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(),
    ),
  );

/** remplace chaque doublon par un clone du premier fichier du groupe ; renvoie les octets regagnés */
export async function cloneDuplicates(groups: string[][]): Promise<number> {
  let saved = 0;
  for (const [keep, ...others] of groups) {
    const { size } = await stat(keep);
    for (const file of others) {
      const temp = `${file}.mortex-clone`;
      try {
        // -p garde dates et droits du fichier gardé, identiques en contenu
        await cp(["-cp", keep, temp]);
        await rename(temp, file);
        saved += size;
      } catch {
        await rm(temp, { force: true });
      }
    }
  }
  return saved;
}
