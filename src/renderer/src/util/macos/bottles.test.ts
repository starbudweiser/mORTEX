import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("../getVortexPath", () => ({ default: () => os.tmpdir() }));

import {
  hostToWinPath,
  readRegString,
  scanSteamGames,
  winPathToHost,
  type IBottle,
} from "./bottles";

function makeBottle(): IBottle {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bottle-"));
  const steam = path.join(root, "drive_c/Program Files (x86)/Steam");
  fs.mkdirSync(path.join(steam, "config"), { recursive: true });
  fs.mkdirSync(path.join(steam, "steamapps/common/Skyrim Special Edition"), { recursive: true });
  fs.writeFileSync(path.join(steam, "steamapps/common/Skyrim Special Edition/SkyrimSE.exe"), "");
  fs.writeFileSync(path.join(steam, "config/libraryfolders.vdf"), '"libraryfolders"\n{\n}\n');
  fs.writeFileSync(
    path.join(steam, "steamapps/appmanifest_489830.acf"),
    '"AppState"\n{\n"appid" "489830"\n"name" "The Elder Scrolls V: Skyrim Special Edition"\n"installdir" "Skyrim Special Edition"\n}\n',
  );
  fs.writeFileSync(
    path.join(root, "system.reg"),
    'WINE REGISTRY Version 2\n\n[Software\\\\Wow6432Node\\\\Bethesda Softworks\\\\Skyrim Special Edition] 1\n"Installed Path"="C:\\\\Games\\\\Skyrim SE\\\\"\n',
  );
  return {
    path: root,
    name: "b",
    kind: "crossover",
    userDir: path.join(root, "drive_c/users/crossover"),
  };
}

describe("bottles", () => {
  const b = makeBottle();
  it("reads system.reg", () => {
    expect(
      readRegString(
        b,
        "HKEY_LOCAL_MACHINE",
        "Software\\Wow6432Node\\Bethesda Softworks\\Skyrim Special Edition",
        "Installed Path",
      ),
    ).toBe("C:\\Games\\Skyrim SE\\");
  });
  it("converts paths", () => {
    expect(winPathToHost(b, "C:\\Games\\X")).toBe(path.join(b.path, "drive_c/Games/X"));
    expect(hostToWinPath(b, path.join(b.path, "drive_c/Games/X"))).toBe("C:\\Games\\X");
  });
  it("scans steam manifests", () => {
    const g = scanSteamGames(b);
    expect(g.map((e) => e.appid)).toEqual(["489830"]);
  });
});
