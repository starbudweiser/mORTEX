/**
 * mORTEX (macOS) : chargement et enregistrement des raccourcis clavier de Skyrim.
 * Noms, touches d'origine et actions modifiables : la table `controlmap.txt`, dans le fichier libre d'un
 * mod (`Data\Interface\Controls\PC`) ou, sinon, dans « Skyrim - Interface.bsa » (lue sans rien extraire).
 * Touches choisies par le joueur : le fichier binaire `ControlMap_Custom.txt` que Skyrim lit et écrit dans
 * son dossier (voir controlBinary.ts). Les sauvegardes vont dans « mORTEX Backups » à côté des INI.
 */
import { access, constants, readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { type IBackup, createBackup, restoreBackup } from "./backup";
import { readFromBsa } from "./bsaRead";
import {
  CONTROL_EVENT_IDS,
  defaultControlFile,
  readControlKeys,
  writeControlKeys,
} from "./controlBinary";
import { eventSlug } from "./controlGroups";
import {
  type IControlChange,
  type IControlMap,
  changedEvents,
  keyCombos,
  parseControlMap,
  withKeyboard,
} from "./controlMap";
import { SettingsSaveError } from "./save";

export const CUSTOM_NAME = "ControlMap_Custom.txt";
const INNER_PATH = "interface\\controls\\pc\\controlmap.txt";
const LOOSE_PATH = ["Data", "Interface", "Controls", "PC", "controlmap.txt"];

export interface ILoadedControls {
  /** table du jeu (ou du mod) : noms, touches d'origine, actions modifiables */
  base: IControlMap;
  /** table en vigueur : la base avec les touches du fichier du jeu, s'il existe */
  current: IControlMap;
  /** d'où vient la base : chemin du fichier libre, ou nom de l'archive */
  source: string;
  /** `ControlMap_Custom.txt` dans le dossier du jeu */
  customPath: string;
  customExists: boolean;
  /** fichier binaire en vigueur, ou fichier d'origine s'il n'existe pas encore */
  file: Buffer;
  /** dossier qui reçoit « mORTEX Backups » (celui des INI) */
  backupDir: string;
}

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch {
    return undefined;
  }
}

async function findInterfaceArchive(dataDir: string): Promise<string | undefined> {
  const names = await readdir(dataDir).catch(() => [] as string[]);
  const name = names.find((n) => n.toLowerCase() === "skyrim - interface.bsa");
  return name === undefined ? undefined : path.join(dataDir, name);
}

/** la table avec les touches du fichier du jeu par-dessus */
function applyFileKeys(base: IControlMap, file: Buffer): IControlMap {
  const keys = readControlKeys(file);
  let result = base;
  for (const context of base.contexts)
    for (const event of context.events) {
      const id = CONTROL_EVENT_IDS[eventSlug(event.name)];
      if (id === undefined) continue;
      const key = keys.get(id);
      result = withKeyboard(result, context.index, event.name, key === undefined ? [] : [[key]]);
    }
  return result;
}

export async function loadControls(gamePath: string, iniDir: string): Promise<ILoadedControls> {
  const loosePath = path.join(gamePath, ...LOOSE_PATH);
  const looseData = await readIfExists(loosePath);
  let text = looseData?.toString("latin1");
  let source = loosePath;
  if (text === undefined) {
    const archive = await findInterfaceArchive(path.join(gamePath, "Data"));
    if (archive === undefined) throw new Error("« Skyrim - Interface.bsa » est introuvable");
    const data = await readFromBsa(archive, INNER_PATH);
    if (data === undefined) throw new Error("La table des commandes est absente de l'archive");
    text = data.toString("latin1");
    source = path.basename(archive);
  }
  const base = parseControlMap(text);
  const customPath = path.join(gamePath, CUSTOM_NAME);
  const custom = await readIfExists(customPath);
  return {
    base,
    current: custom === undefined ? base : applyFileKeys(base, custom),
    source,
    customPath,
    customExists: custom !== undefined,
    file: custom ?? defaultControlFile(),
    backupDir: iniDir,
  };
}

export interface IControlsPlan {
  path: string;
  /** contenu complet à écrire */
  data: Buffer;
  /** vrai si `ControlMap_Custom.txt` n'existe pas encore */
  created: boolean;
  /** changements par rapport aux touches en vigueur */
  changes: IControlChange[];
  backupDir: string;
}

export function planControlsSave(loaded: ILoadedControls, edited: IControlMap): IControlsPlan {
  const keys = new Map<number, number>();
  for (const context of edited.contexts)
    for (const event of context.events) {
      const id = CONTROL_EVENT_IDS[eventSlug(event.name)];
      if (id === undefined) continue;
      const combos = keyCombos(event);
      if (combos.length !== 1 || combos[0].length !== 1)
        throw new Error(`Une seule touche est possible pour « ${event.name} »`);
      keys.set(id, combos[0][0]);
    }
  return {
    path: loaded.customPath,
    data: writeControlKeys(loaded.file, keys),
    created: !loaded.customExists,
    changes: changedEvents(loaded.current, edited),
    backupDir: loaded.backupDir,
  };
}

/** écrit le fichier après une copie de sécurité ; remet l'état d'avant si l'écriture échoue */
export async function commitControlsSave(plan: IControlsPlan): Promise<IBackup> {
  if (!plan.created)
    await access(plan.path, constants.W_OK).catch(() => {
      throw new SettingsSaveError("readOnly", plan.path);
    });
  const backup = await createBackup(
    plan.created ? [] : [plan.path],
    plan.created ? [plan.path] : [],
    new Date(),
    plan.backupDir,
  );
  try {
    await writeFile(plan.path, plan.data);
  } catch (err) {
    await restoreBackup(backup.dir).catch(() => undefined);
    throw err;
  }
  return backup;
}
