import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  displayTweaksTargets,
  fixDisplayTweaks,
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
