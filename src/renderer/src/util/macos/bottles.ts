/**
 * mORTEX (macOS) : magasin de jeux des bouteilles Wine (CrossOver, Wine brut).
 * Les bouteilles elles-mêmes (liste, chemins, registre, lancement) sont dans bottlesCore.ts, le
 * moteur commun recopié depuis _tools/shared/mackit ; ce fichier le réexporte, branche son fichier
 * d'état sur <userData>/bottles.json et son journal sur celui de mORTEX, puis ajoute :
 *  - bottleRegistryLookup("HKLM:clé:valeur")        équivalent de registryLookup pour storeLookup
 *  - scanSteamGames(bottle)                         appmanifests des bibliothèques Steam de la bouteille
 *  - WineBottlesStore (id "wine")                   IGameStore branché dans GameModeManager
 *
 * `userDir` (drive_c/users/<u>) est écrit ici et lu par le processus principal
 * (main/src/macos/bottlePaths.ts) pour rediriger documents et localAppData ;
 * s'il change pendant que mORTEX tourne, les chemins du renderer suivent aussitôt.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { parse as parseVdf } from "simple-vdf";

import { log } from "@/logging";

import { ApplicationData } from "../../applicationData";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IGameStore, IGameStoreSnapshot } from "../../types/IGameStore";
import { GameEntryNotFound } from "../../types/IGameStore";
import type { IGameStoreEntry } from "../../types/IGameStoreEntry";
import getVortexPath from "../getVortexPath";
import {
  configureBottles,
  isDir,
  isNonEmptyDir,
  listBottles,
  readRegString,
  readState,
  winPathToHost,
  writeState,
  type IBottle,
} from "./bottlesCore";

export * from "./bottlesCore";

configureBottles({ statePath: () => path.join(getVortexPath("userData"), "bottles.json"), log });

const STORE_ID = "wine";

export interface IScannedBottle {
  bottle: IBottle;
  games: number;
}

/**
 * Dossier utilisateur à rediriger : bouteille active, ou déjà utilisée par un jeu (« My Games ») ;
 * à défaut, celle qui contient un jeu jamais lancé, le cas d'une première installation.
 */
export function pickUserDir(
  scanned: IScannedBottle[],
  activeBottle: string | undefined,
): string | undefined {
  const used = scanned.find(
    ({ bottle }) =>
      bottle.path === activeBottle || isDir(path.join(bottle.userDir, "Documents/My Games")),
  );
  return (used ?? scanned.find(({ games }) => games > 0))?.bottle.userDir;
}

/** Même contrat que registryLookup (storeLookup) mais lu dans les bouteilles. */
export async function bottleRegistryLookup(lookup: string): Promise<IGameStoreEntry> {
  const [hive, key, value] = lookup.split(":", 3);
  const short: Record<string, string> = {
    HKLM: "HKEY_LOCAL_MACHINE",
    HKCU: "HKEY_CURRENT_USER",
  };
  for (const bottle of listBottles()) {
    const raw = readRegString(bottle, short[hive] ?? hive, key, value);
    if (raw) {
      const gamePath = winPathToHost(bottle, raw).replace(/\/+$/, "");
      if (!isNonEmptyDir(gamePath)) continue;
      return {
        appid: lookup,
        gamePath,
        gameStoreId: "registry",
        name: path.basename(gamePath),
      };
    }
  }
  throw new GameEntryNotFound(lookup, "registry");
}

function steamLibraries(bottle: IBottle): string[] {
  const libs: string[] = [];
  for (const pf of ["Program Files (x86)", "Program Files"]) {
    const base = path.join(bottle.path, "drive_c", pf, "Steam");
    if (!isDir(base)) continue;
    libs.push(base);
    try {
      const vdf = parseVdf(
        fs.readFileSync(path.join(base, "config/libraryfolders.vdf"), "utf8"),
      ) as any;
      const root = vdf?.libraryfolders ?? vdf?.LibraryFolders ?? {};
      for (const k of Object.keys(root)) {
        const p = root[k]?.path;
        if (typeof p === "string") libs.push(winPathToHost(bottle, p));
      }
    } catch {
      /* pas de libraryfolders.vdf */
    }
  }
  return [...new Set(libs)];
}

export function scanSteamGames(bottle: IBottle): IGameStoreEntry[] {
  const entries: IGameStoreEntry[] = [];
  for (const lib of steamLibraries(bottle)) {
    const apps = path.join(lib, "steamapps");
    let files: string[];
    try {
      files = fs.readdirSync(apps).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const st = (parseVdf(fs.readFileSync(path.join(apps, f), "utf8")) as any)?.AppState;
        if (!st?.appid || !st?.name || !st?.installdir) continue;
        const gamePath = path.join(apps, "common", st.installdir);
        if (!isNonEmptyDir(gamePath)) continue;
        entries.push({
          appid: String(st.appid),
          name: String(st.name),
          gamePath,
          gameStoreId: STORE_ID,
          lastUpdated: new Date(Number(st.LastUpdated ?? 0) * 1000),
        });
      } catch (err) {
        log("debug", "bad appmanifest in bottle", { f, err });
      }
    }
  }
  return entries;
}

/** Jeux hors Steam : sous-dossiers directs de C:\\Games, Program Files, GOG Games... */
export function scanLooseGames(bottle: IBottle): IGameStoreEntry[] {
  const entries: IGameStoreEntry[] = [];
  const roots = ["Games", "GOG Games", "Program Files", "Program Files (x86)", "Epic Games"];
  const seen = new Set<string>();
  for (const root of roots) {
    const dir = path.join(bottle.path, "drive_c", root);
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const gamePath = path.join(dir, name);
      const key = gamePath.toLowerCase();
      if (seen.has(key) || !isNonEmptyDir(gamePath) || name.startsWith(".")) continue;
      seen.add(key);
      entries.push({ appid: name, name, gamePath, gameStoreId: STORE_ID });
    }
  }
  return entries;
}

class WineBottlesStore implements IGameStore {
  public id = STORE_ID;
  public name = "Wine bottle (CrossOver)";
  public priority = 40;

  #snapshot: IGameStoreSnapshot = { entries: [], isInstalled: false };

  public allGames(): Promise<IGameStoreEntry[]> {
    return Promise.resolve(this.#snapshot.entries);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public async reloadGames(): Promise<void> {
    const bottles = listBottles();
    const entries: IGameStoreEntry[] = [];
    const scanned: IScannedBottle[] = [];
    for (const bottle of bottles) {
      const found = [...scanSteamGames(bottle), ...scanLooseGames(bottle)];
      scanned.push({ bottle, games: found.length });
      entries.push(...found);
    }
    this.#snapshot = { entries, isInstalled: bottles.length > 0 };
    const userDir = pickUserDir(scanned, readState().activeBottle);
    if (userDir !== undefined && readState().userDir !== userDir) {
      writeState({ userDir });
      // sans cela, les chemins lus au démarrage restent ceux du Mac jusqu'à la relance de mORTEX
      const paths = ApplicationData.instance.paths;
      paths.documents = path.join(userDir, "Documents");
      paths.localAppData = path.join(userDir, "AppData", "Local");
      fs.mkdirSync(paths.localAppData, { recursive: true });
    }
  }

  public async findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const ids = Array.isArray(appId) ? appId : [appId];
    const entry = this.#snapshot.entries.find((e) => ids.includes(e.appid));
    if (entry === undefined) throw new GameEntryNotFound(ids.join(", "), STORE_ID);
    return entry;
  }

  public async findByName(namePattern: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + namePattern + "$", "i");
    const entry = this.#snapshot.entries.find((e) => re.test(e.name));
    if (entry === undefined) throw new GameEntryNotFound(namePattern, STORE_ID);
    return entry;
  }

  public getGameStorePath(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  public isGameStoreInstalled(): Promise<boolean> {
    return Promise.resolve(this.#snapshot.isInstalled);
  }

  public async launchGame(appInfo: any, _api?: IExtensionApi): Promise<void> {
    // le lancement passe par StarterInfo.runDirectly -> runInBottle
    throw new GameEntryNotFound(String(appInfo?.steamAppId ?? appInfo), STORE_ID);
  }
}

export function createWineBottlesStore(): IGameStore | undefined {
  return process.platform === "darwin" ? new WineBottlesStore() : undefined;
}
