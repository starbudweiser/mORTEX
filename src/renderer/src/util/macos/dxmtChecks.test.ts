import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyMacDisplayTweaks,
  displayTweaksTargets,
  dllFileVersion,
  hasDisplayTweaks,
  fixDisplayTweaks,
  parseShadersLog,
  graphicsBackend,
  runDxmtChecks,
  useDxmt,
} from "./dxmtChecks";

describe("DXMT checks", () => {
  let tmp: string;
  let bottle: string;
  let game: string;
  let plugins: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-dxmt-"));
    bottle = path.join(tmp, "bottle");
    game = path.join(bottle, "drive_c", "Games", "Skyrim Special Edition");
    plugins = path.join(game, "Data", "SKSE", "Plugins");
    fs.mkdirSync(plugins, { recursive: true });
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const byId = async () =>
    Object.fromEntries((await runDxmtChecks(bottle, game)).map((check) => [check.id, check]));

  it("accepts a DXMT bottle with Bottled, the bridge and flip_discard", async () => {
    fs.writeFileSync(path.join(bottle, "cxbottle.conf"), '"CX_GRAPHICS_BACKEND" = "dxmt"\n');
    fs.writeFileSync(path.join(game, "d3d11.dll"), "MZ...mDLSS_enb_bridge.log...");
    fs.writeFileSync(path.join(plugins, "CommunityShaders.dll"), "");
    const video = displayTweaksTargets().VideoMemorySizeMb;
    fs.writeFileSync(
      path.join(plugins, "SSEDisplayTweaks.ini"),
      `[Render]\nSwapEffect = flip_discard\nSwapBufferCount = 3\nVideoMemorySizeMb = ${video}\n`,
    );

    const checks = await byId();
    expect(checks.engine.status).toBe("ok");
    expect(checks.bridge.status).toBe("ok");
    expect(checks.displayTweaks.status).toBe("ok");
    expect(checks.bottledDuplicates.status).toBe("ok");
  });

  it("flags DXVK, a wrong swap effect and duplicates of Bottled's own plugins", async () => {
    fs.writeFileSync(path.join(bottle, "cxbottle.conf"), '"CX_GRAPHICS_BACKEND" = "dxvk"\n');
    fs.writeFileSync(path.join(game, "d3d11.dll"), "some other d3d11");
    fs.writeFileSync(path.join(plugins, "CommunityShaders.dll"), "");
    fs.writeFileSync(path.join(plugins, "TerrainHelper.dll"), "");
    fs.writeFileSync(
      path.join(plugins, "SSEDisplayTweaks.ini"),
      "[Render]\nSwapEffect = auto ; comment\n",
    );

    const checks = await byId();
    expect(checks.engine).toEqual({ id: "engine", status: "error", found: "dxvk" });
    expect(checks.bridge.status).toBe("na");
    expect(checks.displayTweaks.status).toBe("error");
    expect(checks.displayTweaks.found).toContain("SwapEffect = auto");
    expect(checks.bottledDuplicates.found).toBe("TerrainHelper.dll");
  });

  describe("shaders", () => {
    const logDir = () =>
      path.join(
        bottle,
        "drive_c",
        "users",
        "crossover",
        "Documents",
        "My Games",
        "Skyrim Special Edition",
        "SKSE",
      );
    const writeLog = (text: string) => {
      fs.mkdirSync(logDir(), { recursive: true });
      fs.writeFileSync(path.join(logDir(), "CommunityShaders.log"), text);
    };
    const writeCompiler = (bytes: number) => {
      const dir = path.join(bottle, "drive_c", "windows", "system32");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "d3dcompiler_47.dll"), Buffer.alloc(bytes));
    };
    const withVersion = Buffer.concat([
      Buffer.from("MZ"),
      Buffer.from("FileVersion", "utf16le"),
      Buffer.from("\0\0 1.2.1.0", "utf16le"),
    ]);

    it("is not applicable without Community Shaders", async () => {
      expect((await byId()).shaders.status).toBe("na");
      expect((await byId()).shaders.shaders).toBeUndefined();
    });

    it("does not claim success before the game has run", async () => {
      fs.writeFileSync(path.join(plugins, "CommunityShaders.dll"), withVersion);
      const { shaders } = await byId();
      expect(shaders.status).toBe("na");
      expect(shaders.shaders).toMatchObject({ logged: false, version: "1.2.1" });
    });

    it("flags shaders the compiler refused, with the compiler of the bottle", async () => {
      fs.writeFileSync(path.join(plugins, "CommunityShaders.dll"), withVersion);
      writeCompiler(179_776);
      writeLog(
        "[01:00:45] [I] loaded\n[01:01:26] [W] Shader compilation failed:\n" +
          "Data\\Shaders\\DeferredCompositeCS.hlsl:10:1: E5000: syntax error, unexpected KW_NAMESPACE\n" +
          "[01:01:27] [W] Shader compilation failed:\nData\\Shaders\\X.hlsl:9:1: E5000: other\n",
      );
      const { shaders } = await byId();
      expect(shaders.status).toBe("error");
      expect(shaders.shaders).toEqual({
        version: "1.2.1",
        logged: true,
        failures: 2,
        reason: "syntax error, unexpected KW_NAMESPACE",
        compiler: "wine",
      });
    });

    it("accepts a log without failures, and tells Microsoft's compiler from Wine's", async () => {
      fs.writeFileSync(path.join(plugins, "CommunityShaders.dll"), withVersion);
      writeCompiler(4_741_488);
      writeLog("[01:00:45] [I] GrassLighting.ini 2-0-0 successfully loaded\n");
      const { shaders } = await byId();
      expect(shaders.status).toBe("ok");
      expect(shaders.shaders?.compiler).toBe("native");
    });

    it("reads the version and the failures out of raw data", () => {
      expect(dllFileVersion(withVersion)).toBe("1.2.1");
      expect(dllFileVersion(Buffer.from("MZ"))).toBeUndefined();
      expect(parseShadersLog("nothing")).toEqual({ failures: 0, reason: undefined });
    });
  });

  it("sizes the video memory from the Mac's memory, up to 16 GB", () => {
    expect(displayTweaksTargets(16 * 1024 ** 3).VideoMemorySizeMb).toBe("8192");
    expect(displayTweaksTargets(64 * 1024 ** 3).VideoMemorySizeMb).toBe("16384");
  });

  it("warns about missing optimisations once the swap effect is right", async () => {
    fs.writeFileSync(
      path.join(plugins, "SSEDisplayTweaks.ini"),
      "[Render]\nSwapEffect = flip_discard\n",
    );
    const checks = await byId();
    expect(checks.displayTweaks.status).toBe("warning");
    // pas de Bottled Shaders : ni bon ni mauvais
    expect(checks.bottledDuplicates.status).toBe("na");
  });

  it("applies the DXMT settings, keeping comments and other lines", async () => {
    const ini = path.join(plugins, "SSEDisplayTweaks.ini");
    const video = displayTweaksTargets().VideoMemorySizeMb;
    fs.writeFileSync(ini, "[Render]\nSwapEffect = auto ; comment\nOther = 1\n");
    await fixDisplayTweaks(game);
    expect(fs.readFileSync(ini, "utf8")).toBe(
      `[Render]\nVideoMemorySizeMb = ${video}\nSwapBufferCount = 3\nSwapEffect = flip_discard ; comment\nOther = 1\n`,
    );
    expect((await byId()).displayTweaks.status).toBe("ok");
  });

  it("tunes SSE Display Tweaks for Mac and can undo it", async () => {
    const ini = path.join(plugins, "SSEDisplayTweaks.ini");
    expect(await hasDisplayTweaks(game)).toBe(false);
    const original =
      "[Render]\nFramerateLimit = 240 ; mine\nOther = 1\n[HAVOK]\nMaximumFramerate = 240\n";
    fs.writeFileSync(ini, original);
    expect(await hasDisplayTweaks(game)).toBe(true);
    const undo = await applyMacDisplayTweaks(game);
    const text = fs.readFileSync(ini, "utf8");
    expect(text).toContain("FramerateLimit = 60 ; mine");
    expect(text).toContain("MaximumFramerate = 60");
    expect(text).toContain("EnableVSync = true");
    expect(text).toContain("Other = 1");
    await undo();
    expect(fs.readFileSync(ini, "utf8")).toBe(original);
  });

  it("switches the bottle to DXMT, keeping the rest of cxbottle.conf", async () => {
    const conf = path.join(bottle, "cxbottle.conf");
    fs.writeFileSync(
      conf,
      '[Bottle]\n"Preview" = "0"\n\n[EnvironmentVariables]\n"CX_GRAPHICS_BACKEND" = "dxvk"\n"WINEMSYNC" = "1"\n',
    );
    await useDxmt(bottle);
    expect(await graphicsBackend(bottle)).toBe("dxmt");
    const text = fs.readFileSync(conf, "utf8");
    expect(text).toContain('"WINEMSYNC" = "1"');
    expect(text).toContain('"Preview" = "0"');
  });
});
