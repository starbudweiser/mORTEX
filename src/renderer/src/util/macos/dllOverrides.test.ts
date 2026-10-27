import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IBottle, IBottleLaunch } from "./bottles";
import { planOverrides, proxyDlls, regFile, syncDllOverrides } from "./dllOverrides";

describe("DLL overrides", () => {
  let tmp: string;
  let bottle: IBottle;
  let game: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-dll-"));
    const bottlePath = path.join(tmp, "Test");
    game = path.join(bottlePath, "drive_c", "Games", "Skyrim Special Edition");
    fs.mkdirSync(game, { recursive: true });
    fs.writeFileSync(
      path.join(bottlePath, "user.reg"),
      'WINE REGISTRY Version 2\n\n[Software\\\\Wine\\\\DllOverrides] 1\n"d3d11"="native,builtin"\n"dxgi"="builtin"\n',
    );
    bottle = { path: bottlePath, name: "Test", kind: "crossover", userDir: "" };
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("finds the proxy DLLs mods leave next to the game", async () => {
    for (const file of ["d3d11.dll", "DInput8.DLL", "skse64_1_6_1170.dll", "SkyrimSE.exe"]) {
      fs.writeFileSync(path.join(game, file), "");
    }
    expect((await proxyDlls(game)).sort()).toEqual(["d3d11", "dinput8"]);
  });

  it("adds what's missing and removes only its own overrides once the DLL is gone", () => {
    const current = (dll: string) => ({ d3d11: "native,builtin", dxgi: "builtin" })[dll];
    expect(planOverrides(["d3d11", "dxgi", "dinput8"], current, [])).toEqual({
      add: ["dxgi", "dinput8"],
      remove: [],
    });
    expect(planOverrides(["d3d11"], current, ["dinput8", "version"])).toEqual({
      add: [],
      remove: ["dinput8", "version"],
    });
  });

  it("writes a registry file for regedit", () => {
    expect(regFile({ add: ["dxgi"], remove: ["version"] })).toBe(
      'REGEDIT4\r\n\r\n[HKEY_CURRENT_USER\\Software\\Wine\\DllOverrides]\r\n"dxgi"="native,builtin"\r\n"version"=-\r\n',
    );
  });

  it("applies the plan in the bottle and remembers what it added", async () => {
    fs.writeFileSync(path.join(game, "d3d11.dll"), "");
    fs.writeFileSync(path.join(game, "dxgi.dll"), "");
    const runs: Array<{ command: IBottleLaunch; reg: string }> = [];
    const run = async (command: IBottleLaunch) => {
      const reg = path.join(bottle.path, "drive_c", "windows", "temp", "mortex-dll-overrides.reg");
      runs.push({ command, reg: fs.readFileSync(reg, "latin1") });
    };

    expect(await syncDllOverrides(bottle, game, run)).toEqual({ add: ["dxgi"], remove: [] });
    expect(runs).toHaveLength(1);
    expect(runs[0].command.args).toEqual([
      "--bottle",
      "Test",
      "regedit",
      "/S",
      "C:\\windows\\temp\\mortex-dll-overrides.reg",
    ]);
    expect(runs[0].reg).toContain('"dxgi"="native,builtin"');

    // déjà posé : rien à refaire, même si user.reg n'est pas encore réécrit
    expect(await syncDllOverrides(bottle, game, run)).toEqual({ add: [], remove: [] });
    expect(runs).toHaveLength(1);

    fs.rmSync(path.join(game, "dxgi.dll"));
    expect(await syncDllOverrides(bottle, game, run)).toEqual({ add: [], remove: ["dxgi"] });
    expect(runs[1].reg).toContain('"dxgi"=-');
    expect(
      JSON.parse(fs.readFileSync(path.join(bottle.path, "mortex-dll-overrides.json"), "utf8")),
    ).toEqual({ added: [] });
  });
});
