/**
 * mORTEX (macOS) : lecture d'un seul fichier dans une archive BSA de Skyrim (versions 104 et 105),
 * pour la table des commandes rangée dans « Skyrim - Interface.bsa ». Seules les archives non compressées
 * ou compressées en zlib sont lues (celle de l'interface n'est pas compressée) ; une archive en LZ4 est
 * refusée avec une erreur claire plutôt que mal lue.
 */
import { open } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const FLAG_COMPRESSED = 0x4;
const FLAG_EMBEDDED_NAMES = 0x100;
const SIZE_TOGGLE_COMPRESSION = 0x40000000;

interface IEntry {
  name: string;
  size: number;
  offset: number;
}

/** liste des fichiers de l'index (`dossier\fichier` en minuscules) avec leur taille et leur position */
export function parseBsaIndex(index: Buffer): {
  entries: IEntry[];
  flags: number;
  version: number;
} {
  if (index.toString("latin1", 0, 4) !== "BSA\0") throw new Error("Ce n'est pas une archive BSA");
  const version = index.readUInt32LE(4);
  if (version !== 104 && version !== 105) throw new Error(`Version de BSA non gérée : ${version}`);
  const flags = index.readUInt32LE(12);
  const folderCount = index.readUInt32LE(16);
  const fileCount = index.readUInt32LE(20);
  const fileNamesLength = index.readUInt32LE(28);
  const recordSize = version === 105 ? 24 : 16;

  const folders: Array<{ count: number; offset: number }> = [];
  for (let i = 0; i < folderCount; i++) {
    const at = 36 + i * recordSize;
    const count = index.readUInt32LE(at + 8);
    // v105 : 8 octets de position après 4 octets de remplissage ; v104 : 4 octets directement
    const offset =
      version === 105 ? Number(index.readBigUInt64LE(at + 16)) : index.readUInt32LE(at + 12);
    folders.push({ count, offset: offset - fileNamesLength });
  }

  const files: Array<{ folder: string; size: number; offset: number }> = [];
  let blocksEnd = 36 + folderCount * recordSize;
  for (const folder of folders) {
    const length = index[folder.offset];
    const name = index.toString("latin1", folder.offset + 1, folder.offset + length);
    let at = folder.offset + 1 + length;
    for (let i = 0; i < folder.count; i++) {
      files.push({
        folder: name,
        size: index.readUInt32LE(at + 8),
        offset: index.readUInt32LE(at + 12),
      });
      at += 16;
    }
    blocksEnd = Math.max(blocksEnd, at);
  }

  const entries: IEntry[] = [];
  let at = blocksEnd;
  for (let i = 0; i < fileCount; i++) {
    const end = index.indexOf(0, at);
    const file = files[i];
    entries.push({
      name: `${file.folder}\\${index.toString("latin1", at, end)}`.toLowerCase(),
      size: file.size,
      offset: file.offset,
    });
    at = end + 1;
  }
  return { entries, flags, version };
}

/** taille de l'index à lire en tête d'archive, d'après l'en-tête de 36 octets */
export function bsaIndexSize(header: Buffer): number {
  const version = header.readUInt32LE(4);
  const folderCount = header.readUInt32LE(16);
  const fileCount = header.readUInt32LE(20);
  const folderNamesLength = header.readUInt32LE(24);
  const fileNamesLength = header.readUInt32LE(28);
  const recordSize = version === 105 ? 24 : 16;
  return (
    36 +
    folderCount * recordSize +
    folderNamesLength +
    folderCount +
    fileCount * 16 +
    fileNamesLength
  );
}

/** contenu du fichier `inner` (par exemple `interface\controls\pc\controlmap.txt`) ou undefined s'il n'y est pas */
export async function readFromBsa(bsaPath: string, inner: string): Promise<Buffer | undefined> {
  const handle = await open(bsaPath, "r");
  try {
    const header = Buffer.alloc(36);
    await handle.read(header, 0, 36, 0);
    if (header.toString("latin1", 0, 4) !== "BSA\0")
      throw new Error("Ce n'est pas une archive BSA");
    const size = bsaIndexSize(header);
    const index = Buffer.alloc(size);
    await handle.read(index, 0, size, 0);
    const { entries, flags, version } = parseBsaIndex(index);
    const entry = entries.find((e) => e.name === inner.toLowerCase().replace(/\//g, "\\"));
    if (entry === undefined) return undefined;

    let length = entry.size & ~SIZE_TOGGLE_COMPRESSION;
    const compressed = !!(flags & FLAG_COMPRESSED) !== !!(entry.size & SIZE_TOGGLE_COMPRESSION);
    const raw = Buffer.alloc(length);
    await handle.read(raw, 0, length, entry.offset);
    let at = 0;
    if (flags & FLAG_EMBEDDED_NAMES && version >= 104) at = 1 + raw[0];
    if (!compressed) return raw.subarray(at, length);
    if (version === 105) throw new Error("Archive compressée en LZ4 : lecture non gérée");
    length -= at;
    return inflateSync(raw.subarray(at + 4, at + length));
  } finally {
    await handle.close();
  }
}
