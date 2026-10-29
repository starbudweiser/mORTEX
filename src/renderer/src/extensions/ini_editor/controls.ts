/**
 * mORTEX (macOS) : chargement et enregistrement des raccourcis clavier de Skyrim.
 * Table de base : `Data\Interface\Controls\PC\controlmap.txt` s'il existe (un mod peut en fournir une),
 * sinon celle de « Skyrim - Interface.bsa », lue sans rien extraire. Table personnelle : `ControlMap_Custom.txt`
 * dans « My Games », à côté des INI. On y écrit une copie complète de la table (base + changements).
 */
import { access, constants, readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { type IBackup, createBackup, restoreBackup } from "./backup";
import { readFromBsa } from "./bsaRead";
import {
  type IControlChange,
  type IControlMap,
  changedEvents,
  mergeCustom,
  parseControlMap,
  serializeControlMap,
} from "./controlMap";
import { SettingsSaveError } from "./save";

export const CUSTOM_NAME = "ControlMap_Custom.txt";
const INNER_PATH = "interface\\controls\\pc\\controlmap.txt";
const LOOSE_PATH = ["Data", "Interface", "Controls", "PC", "controlmap.txt"];

export interface ILoadedControls {
  /** table du jeu (ou du mod) sans nos changements */
  base: IControlMap;
  /** table en vigueur : base + `ControlMap_Custom.txt` s'il existe */
  current: IControlMap;
  /** d'où vient la base : chemin du fichier libre, ou nom de l'archive */
  source: string;
  customPath: string;
  customExists: boolean;
}

const decode = (data: Buffer) => data.toString("latin1");

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return decode(await readFile(file));
  } catch {
    return undefined;
  }
}

async function findInterfaceArchive(dataDir: string): Promise<string | undefined> {
  const names = await readdir(dataDir).catch(() => [] as string[]);
  const name = names.find((n) => n.toLowerCase() === "skyrim - interface.bsa");
  return name === undefined ? undefined : path.join(dataDir, name);
}

export async function loadControls(gamePath: string, iniDir: string): Promise<ILoadedControls> {
  const loosePath = path.join(gamePath, ...LOOSE_PATH);
  let text = await readIfExists(loosePath);
  let source = loosePath;
  if (text === undefined) {
    const archive = await findInterfaceArchive(path.join(gamePath, "Data"));
    if (archive === undefined) throw new Error("« Skyrim - Interface.bsa » est introuvable");
    const data = await readFromBsa(archive, INNER_PATH);
    if (data === undefined) throw new Error("La table des commandes est absente de l'archive");
    text = decode(data);
    source = path.basename(archive);
  }
  const base = parseControlMap(text);
  const customPath = path.join(iniDir, CUSTOM_NAME);
  const customText = await readIfExists(customPath);
  const current = customText === undefined ? base : mergeCustom(base, parseControlMap(customText));
  return { base, current, source, customPath, customExists: customText !== undefined };
}

export interface IControlsPlan {
  path: string;
  /** texte complet à écrire */
  text: string;
  /** vrai si `ControlMap_Custom.txt` n'existe pas encore */
  created: boolean;
  /** changements par rapport à la table de base */
  changes: IControlChange[];
}

export function planControlsSave(loaded: ILoadedControls, edited: IControlMap): IControlsPlan {
  return {
    path: loaded.customPath,
    text: serializeControlMap(edited),
    created: !loaded.customExists,
    changes: changedEvents(loaded.base, edited),
  };
}

/** écrit le fichier personnel après une copie de sécurité ; remet l'état d'avant si l'écriture échoue */
export async function commitControlsSave(plan: IControlsPlan): Promise<IBackup> {
  if (!plan.created)
    await access(plan.path, constants.W_OK).catch(() => {
      throw new SettingsSaveError("readOnly", plan.path);
    });
  const backup = await createBackup(
    plan.created ? [] : [plan.path],
    plan.created ? [plan.path] : [],
  );
  try {
    await writeFile(plan.path, Buffer.from(plan.text, "latin1"));
  } catch (err) {
    await restoreBackup(backup.dir).catch(() => undefined);
    throw err;
  }
  return backup;
}
