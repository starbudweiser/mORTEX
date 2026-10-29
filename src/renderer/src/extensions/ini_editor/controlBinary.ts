/**
 * mORTEX (macOS) : le fichier binaire `ControlMap_Custom.txt` que Skyrim écrit quand on change une
 * touche dans son menu des commandes. Skyrim le lit et l'écrit dans son dossier de travail, c'est-à-dire
 * le dossier du jeu (à côté de SkyrimSE.exe), et non dans « My Games ».
 *
 * Format observé (Skyrim SE 1.6.1170, essayé en jeu) :
 *  - 12 octets d'en-tête ;
 *  - un enregistrement de 5 octets par action au clavier : code de la touche (DIK, 1 octet) puis
 *    identifiant de l'action (4 octets, petit boutiste), triés par touche, jusqu'au premier
 *    enregistrement dont la touche vaut 0xff ;
 *  - ensuite les sections souris et manette, qu'on ne touche jamais.
 *
 * On ne change donc que le code de touche des enregistrements existants, puis on retrie : le nombre
 * d'enregistrements et tout le reste du fichier restent identiques.
 */

/** identifiant d'action du fichier, par action de `controlmap.txt` (observés sur le fichier du jeu) */
export const CONTROL_EVENT_IDS: Readonly<Record<string, number>> = {
  favorites: 0x00,
  strafe_left: 0x01,
  sneak: 0x02,
  back: 0x03,
  quickload: 0x07,
  forward: 0x08,
  activate: 0x09,
  strafe_right: 0x0b,
  toggle_pov: 0x0e,
  quick_stats: 0x0f,
  run: 0x10,
  quick_magic: 0x11,
  journal: 0x12,
  sprint: 0x13,
  shout: 0x14,
  tween_menu: 0x15,
  toggle_always_run: 0x1e,
  quicksave: 0x1f,
  ready_weapon: 0x20,
  jump: 0x21,
  wait: 0x27,
  quick_inventory: 0x28,
  quick_map: 0x29,
  auto_move: 0x2a,
};

const HEADER_SIZE = 12;
const RECORD_SIZE = 5;
const UNBOUND = 0xff;

/**
 * Fichier tel que Skyrim l'écrit avec les touches d'origine : sert de point de départ quand le joueur
 * n'a encore rien changé dans le jeu (copie du fichier du jeu, aucun texte).
 */
const DEFAULT_FILE_BASE64 =
  "AgCKIgAAAAEKAAAADxUAAAAQAAAAABEIAAAAEgkAAAATIAAAABQnAAAAFygAAAAZEQAAAB0CAAAAHgEAAAAfAwAA" +
  "ACALAAAAIQ4AAAAkEgAAACoQAAAALBQAAAAuKgAAADIpAAAANQ8AAAA4EwAAADkhAAAAOh4AAAA/HwAAAEMHAAAA" +
  "/wYAAAD/AgCABwAAAAAGAAAAAREAAAD/EwAAAP8VAAAA/yEAAAD/JwAAAP8pAAAA/yoAAAD/KAAAAP8iAAAA/yAA" +
  "AAD/FAAAAP8SAAAA/xAAAAD/DgAAAP8LAAAA/woAAAD/CAAAAP8CAAAA/wMAAAD/AQAAAP8AAAAA/wkAAAD/DwAA" +
  "AP8CAD8GAAAACQcAAAAKIQAAABAgAAAAIBEAAABACwAAAIAPAAABABAAAAIACAAAEAAKAAAgAAkAAEAADgAAgAA=";

export const defaultControlFile = (): Buffer => Buffer.from(DEFAULT_FILE_BASE64, "base64");

interface IRecord {
  key: number;
  event: Buffer;
}

function readRecords(file: Buffer): IRecord[] {
  if (file.length < HEADER_SIZE + RECORD_SIZE) throw new Error("Fichier de commandes trop court");
  if (file.readUInt16LE(0) !== 2) throw new Error("Version du fichier de commandes inconnue");
  const records: IRecord[] = [];
  for (
    let at = HEADER_SIZE;
    at + RECORD_SIZE <= file.length && file[at] !== UNBOUND;
    at += RECORD_SIZE
  )
    records.push({ key: file[at], event: Buffer.from(file.subarray(at + 1, at + RECORD_SIZE)) });
  if (records.length === 0) throw new Error("Aucune touche dans le fichier de commandes");
  return records;
}

const eventId = (record: IRecord) => record.event.readUInt32LE(0);

/** touche (code DIK) de chaque action au clavier, par identifiant d'action */
export function readControlKeys(file: Buffer): Map<number, number> {
  return new Map(readRecords(file).map((r) => [eventId(r), r.key]));
}

/**
 * Nouveau fichier avec ces touches (identifiant d'action → code DIK). Une action absente du fichier ou
 * deux actions sur la même touche sont refusées.
 */
export function writeControlKeys(file: Buffer, keys: ReadonlyMap<number, number>): Buffer {
  const records = readRecords(file);
  const known = new Set(records.map(eventId));
  for (const id of keys.keys())
    if (!known.has(id))
      throw new Error(`Action absente du fichier de commandes : 0x${id.toString(16)}`);
  const next = records.map((r) => ({ ...r, key: keys.get(eventId(r)) ?? r.key }));
  if (new Set(next.map((r) => r.key)).size !== next.length)
    throw new Error("Deux actions sont sur la même touche");
  next.sort((a, b) => a.key - b.key);
  const out = Buffer.from(file);
  next.forEach((r, i) => {
    const at = HEADER_SIZE + i * RECORD_SIZE;
    out[at] = r.key;
    r.event.copy(out, at + 1);
  });
  return out;
}
