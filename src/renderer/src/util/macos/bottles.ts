/**
 * mORTEX (macOS) : bouteilles Wine (CrossOver, Whisky, Wine brut).
 *
 * Interface :
 *  - listBottles(): IBottle[]                       énumération (CrossOver, Whisky, $WINEPREFIX, ~/.wine, roots de bottles.json)
 *  - bottleForPath(p): IBottle | undefined          bouteille contenant un chemin hôte
 *  - winPathToHost(bottle, "C:\\x") / hostToWinPath un chemin Windows <-> hôte
 *  - readRegString(bottle, hive, key, value)        lit system.reg / user.reg
 *  - bottleRegistryLookup("HKLM:clé:valeur")        équivalent de registryLookup pour storeLookup
 *  - scanSteamGames(bottle)                         appmanifests des bibliothèques Steam de la bouteille
 *  - WineBottlesStore (id "wine")                   IGameStore branché dans GameModeManager
 *  - runInBottle(exe, args, env?)                   {executable, args, env} pour lancer un .exe dans sa bouteille
 *  - wineCommand(bottle, args)                      {executable, args, env} pour un outil Wine (reg, regedit…)
 *  - crossoverBottleDir() / crossoverBinDir()        où CrossOver range ses bouteilles et ses outils
 *
 * État : <userData>/bottles.json  { roots?: string[], activeBottle?: string, exclusive?: boolean, userDir?: string }
 * `exclusive` + `activeBottle` : ne voir que cette bouteille (essais de dev)
 * `userDir` (drive_c/users/<u>) est écrit ici et lu par le processus principal
 * (main/src/macos/bottlePaths.ts) pour rediriger documents et localAppData.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parse as parseVdf } from "simple-vdf";

import { log } from "@/logging";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IGameStore, IGameStoreSnapshot } from "../../types/IGameStore";
import { GameEntryNotFound } from "../../types/IGameStore";
import type { IGameStoreEntry } from "../../types/IGameStoreEntry";
import getVortexPath from "../getVortexPath";

export type BottleKind = "crossover" | "whisky" | "wine";

export interface IBottle {
  path: string;
  name: string;
  kind: BottleKind;
  /** drive_c/users/<user> */
  userDir: string;
}

const STORE_ID = "wine";
const CX_APPS = ["/Applications/CrossOver.app", "/Applications/CrossOver Preview.app"];

/** CrossOver Preview si la bouteille est marquée Preview=1, sinon CrossOver. */
function cxBin(bottle: IBottle): string {
  let preview = false;
  try {
    preview = /^"Preview"\s*=\s*"1"/m.test(
      fs.readFileSync(path.join(bottle.path, "cxbottle.conf"), "utf8"),
    );
  } catch {
    /* pas de cxbottle.conf */
  }
  const app = preview ? CX_APPS[1] : CX_APPS[0];
  return path.join(
    fs.existsSync(app) ? app : (CX_APPS.find(fs.existsSync) ?? CX_APPS[0]),
    "Contents/SharedSupport/CrossOver/bin",
  );
}
const WHISKY_ID = "com.isaacmarovitz.Whisky";

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isNonEmptyDir(p: string): boolean {
  try {
    return fs.readdirSync(p).length > 0;
  } catch {
    return false;
  }
}

function isBottleDir(p: string): boolean {
  return isDir(path.join(p, "drive_c")) && fs.existsSync(path.join(p, "system.reg"));
}

interface IState {
  roots?: string[];
  activeBottle?: string;
  exclusive?: boolean;
  userDir?: string;
}

function statePath(): string {
  return path.join(getVortexPath("userData"), "bottles.json");
}

function readState(): IState {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf8")) as IState;
  } catch {
    return {};
  }
}

function writeState(patch: IState): void {
  try {
    const next = { ...readState(), ...patch };
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
  } catch (err) {
    log("warn", "could not write bottles.json", { err });
  }
}

function run(cmd: string, args: string[]): string | undefined {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return undefined;
  }
}

function crossoverRoots(): string[] {
  const roots = [path.join(os.homedir(), "Library/Application Support/CrossOver/Bottles")];
  const custom = run("defaults", ["read", "com.codeweavers.CrossOver", "BottleDir"]);
  if (custom) roots.push(custom);
  return roots;
}

/** Dossier où CrossOver range ses bouteilles : celui de ses préférences, sinon celui par défaut. */
export function crossoverBottleDir(): string {
  return crossoverRoots().at(-1) as string;
}

/** Dossier `bin` de CrossOver ; la version stable d'abord, undefined s'il n'est pas installé. */
export function crossoverBinDir(): string | undefined {
  const app = CX_APPS.find((candidate) => fs.existsSync(candidate));
  return app && path.join(app, "Contents/SharedSupport/CrossOver/bin");
}

function whiskyRoots(): string[] {
  const base = path.join(os.homedir(), "Library/Containers", WHISKY_ID);
  const roots = [path.join(base, "Bottles")];
  const plist = path.join(base, "Data/Library/Application Support", WHISKY_ID, "BottleVM.plist");
  const json = fs.existsSync(plist) ? run("plutil", ["-convert", "json", "-o", "-", plist]) : "";
  if (json) {
    // emplacements personnalisés : toute chaîne qui est un dossier existant
    const walk = (v: unknown) => {
      if (typeof v === "string") {
        if (v.startsWith("/") && isDir(v)) roots.push(v);
      } else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    try {
      walk(JSON.parse(json));
    } catch {
      /* plist illisible */
    }
  }
  return roots;
}

function pickUser(bottle: string): string {
  const usersDir = path.join(bottle, "drive_c/users");
  let users: string[] = [];
  try {
    users = fs.readdirSync(usersDir).filter((u) => u !== "Public" && isDir(path.join(usersDir, u)));
  } catch {
    /* pas de users */
  }
  const withGames = users.find((u) => isDir(path.join(usersDir, u, "Documents/My Games")));
  const chosen = withGames ?? users.find((u) => u === "crossover") ?? users[0] ?? "crossover";
  return path.join(usersDir, chosen);
}

function kindOf(bottle: string): BottleKind {
  if (bottle.includes(`/Containers/${WHISKY_ID}/`)) return "whisky";
  if (fs.existsSync(path.join(bottle, "cxbottle.conf"))) return "crossover";
  return "wine";
}

export function listBottles(): IBottle[] {
  const state = readState();
  const seen = new Set<string>();
  const result: IBottle[] = [];
  const add = (p: string) => {
    const real = path.resolve(p);
    if (seen.has(real) || !isBottleDir(real)) return false;
    seen.add(real);
    result.push({
      path: real,
      name: path.basename(real),
      kind: kindOf(real),
      userDir: pickUser(real),
    });
    return true;
  };
  const scanRoot = (root: string) => {
    if (add(root)) return;
    try {
      for (const e of fs.readdirSync(root)) add(path.join(root, e));
    } catch {
      /* racine absente */
    }
  };
  [
    ...(state.roots ?? []),
    ...crossoverRoots(),
    ...whiskyRoots(),
    ...(process.env.WINEPREFIX ? [process.env.WINEPREFIX] : []),
    path.join(os.homedir(), ".wine"),
  ].forEach(scanRoot);
  if (state.activeBottle && state.exclusive) {
    return result.filter((b) => b.path === state.activeBottle);
  }
  if (state.activeBottle) {
    result.sort((a, b) => +(b.path === state.activeBottle) - +(a.path === state.activeBottle));
  }
  return result;
}

export function bottleForPath(p: string, bottles: IBottle[] = listBottles()): IBottle | undefined {
  const real = path.resolve(p);
  return bottles.find((b) => real === b.path || real.startsWith(b.path + path.sep));
}

/** "C:\\Games\\X" -> "<bottle>/drive_c/Games/X" ; "Z:\\a" -> "/a" */
export function winPathToHost(bottle: IBottle, winPath: string): string {
  const m = /^([A-Za-z]):[\\/]*(.*)$/.exec(winPath);
  if (!m) return winPath.replace(/\\/g, "/");
  const letter = m[1].toLowerCase();
  const rest = m[2].replace(/\\/g, "/");
  if (letter === "c") return path.join(bottle.path, "drive_c", rest);
  let root: string | undefined;
  try {
    const link = path.join(bottle.path, "dosdevices", `${letter}:`);
    root = path.resolve(path.dirname(link), fs.readlinkSync(link));
  } catch {
    root = letter === "z" ? "/" : undefined;
  }
  return root === undefined ? winPath : path.join(root, rest);
}

export function hostToWinPath(bottle: IBottle, hostPath: string): string {
  const cDrive = path.join(bottle.path, "drive_c") + path.sep;
  if (hostPath.startsWith(cDrive))
    return "C:\\" + hostPath.slice(cDrive.length).replace(/\//g, "\\");
  return "Z:" + hostPath.replace(/\//g, "\\");
}

function unescapeReg(s: string): string {
  return s.replace(/\\(["\\])/g, "$1");
}

/** Valeur REG_SZ d'une clé de system.reg (HKLM) ou user.reg (HKCU). */
export function readRegString(
  bottle: IBottle,
  hive: string,
  key: string,
  value: string,
): string | undefined {
  const file =
    hive === "HKEY_LOCAL_MACHINE"
      ? "system.reg"
      : hive === "HKEY_CURRENT_USER"
        ? "user.reg"
        : undefined;
  if (file === undefined) return undefined;
  let text: string;
  try {
    text = fs.readFileSync(path.join(bottle.path, file), "latin1");
  } catch {
    return undefined;
  }
  const header = "[" + key.replace(/\\/g, "\\\\").toLowerCase() + "]";
  const wanted = `"${value.replace(/\\/g, "\\\\")}"=`.toLowerCase();
  let inKey = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) {
      const end = line.lastIndexOf("]");
      inKey = line.slice(0, end + 1).toLowerCase() === header;
    } else if (inKey && line.toLowerCase().startsWith(wanted)) {
      const m = /^"(.*)"\s*$/.exec(line.slice(wanted.length).trim());
      return m ? unescapeReg(m[1]) : undefined;
    }
  }
  return undefined;
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

export interface IBottleLaunch {
  executable: string;
  args: string[];
  env: Record<string, string>;
}

/** Commande pour lancer `exe` (chemin hôte) dans sa bouteille ; undefined si hors bouteille. */
export function runInBottle(
  exe: string,
  args: string[] = [],
  cwd?: string,
): IBottleLaunch | undefined {
  const bottle = bottleForPath(exe);
  if (bottle === undefined) return undefined;
  switch (bottle.kind) {
    case "crossover":
      return {
        executable: path.join(cxBin(bottle), "cxstart"),
        args: ["--bottle", bottle.name, ...(cwd ? ["--workdir", cwd] : []), exe, ...args],
        env: { CX_BOTTLE_PATH: path.dirname(bottle.path) },
      };
    case "whisky":
      return {
        executable: path.join(
          os.homedir(),
          "Library/Application Support",
          WHISKY_ID,
          "Libraries/Wine/bin/wine64",
        ),
        args: ["start", "/unix", exe, ...args],
        env: { WINEPREFIX: bottle.path },
      };
    default:
      return {
        executable: "wine64",
        args: ["start", "/unix", exe, ...args],
        env: { WINEPREFIX: bottle.path },
      };
  }
}

/** Commande pour lancer un outil de Wine (`regedit`, `reg`…) dans la bouteille, en attendant sa fin. */
export function wineCommand(bottle: IBottle, args: string[]): IBottleLaunch {
  switch (bottle.kind) {
    case "crossover":
      return {
        executable: path.join(cxBin(bottle), "wine"),
        args: ["--bottle", bottle.name, ...args],
        env: { CX_BOTTLE_PATH: path.dirname(bottle.path) },
      };
    case "whisky":
      return {
        executable: path.join(
          os.homedir(),
          "Library/Application Support",
          WHISKY_ID,
          "Libraries/Wine/bin/wine64",
        ),
        args,
        env: { WINEPREFIX: bottle.path },
      };
    default:
      return { executable: "wine64", args, env: { WINEPREFIX: bottle.path } };
  }
}

class WineBottlesStore implements IGameStore {
  public id = STORE_ID;
  public name = "Wine bottle (CrossOver / Whisky)";
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
    let firstUserDir: string | undefined;
    for (const bottle of bottles) {
      const found = [...scanSteamGames(bottle), ...scanLooseGames(bottle)];
      if (
        firstUserDir === undefined &&
        (bottle.path === readState().activeBottle ||
          isDir(path.join(bottle.userDir, "Documents/My Games")))
      ) {
        firstUserDir = bottle.userDir;
      }
      entries.push(...found);
    }
    this.#snapshot = { entries, isInstalled: bottles.length > 0 };
    if (firstUserDir !== undefined && readState().userDir !== firstUserDir) {
      writeState({ userDir: firstUserDir });
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
