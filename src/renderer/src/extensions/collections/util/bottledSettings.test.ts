import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyBottledSettings,
  hasBottledSettingsBackup,
  mortexSettings,
  restoreBottledSettings,
  settingsUserPath,
  useDlss,
} from "./bottledSettings";

describe("applyBottledSettings", () => {
  let game: string;
  const file = () => settingsUserPath(game);
  const writeUser = (text: string) => {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), text);
  };

  beforeEach(() => {
    game = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-bottled-"));
  });
  afterEach(() => fs.rmSync(game, { recursive: true, force: true }));

  it("keeps the collection's settings untouched", async () => {
    writeUser('{"a":1}');
    await applyBottledSettings(game, "keep");
    expect(fs.readFileSync(file(), "utf8")).toBe('{"a":1}');
    expect(await hasBottledSettingsBackup(game)).toBe(false);
  });

  it("writes the mORTEX settings for DXMT, TAA without the bridge, and undoes them", async () => {
    writeUser('{"Menu":{}}');
    const undo = await applyBottledSettings(game, "mortex");
    expect(JSON.parse(fs.readFileSync(file(), "utf8"))).toEqual(mortexSettings(false));
    expect(mortexSettings(false).Upscaling).toMatchObject({
      upscaleMethod: 1,
      upscaleMethodNoDLSS: 1,
      frameGenerationMode: 0,
      frameGenerationForceEnable: 0,
    });
    await undo();
    expect(fs.readFileSync(file(), "utf8")).toBe('{"Menu":{}}');
    expect(await hasBottledSettingsBackup(game)).toBe(false);
  });

  it("chooses DLSS when the mDLSS bridge is installed", async () => {
    fs.writeFileSync(path.join(game, "d3d11.dll"), "MZ...mDLSS_enb_bridge.log...");
    await applyBottledSettings(game, "mortex");
    expect(JSON.parse(fs.readFileSync(file(), "utf8")).Upscaling.upscaleMethod).toBe(3);
  });

  it("switches the current settings to DLSS, keeping the rest, and undoes it", async () => {
    writeUser('{"Menu":{"x":1},"Upscaling":{"upscaleMethod":2,"other":5}}');
    const undo = await useDlss(game);
    expect(JSON.parse(fs.readFileSync(file(), "utf8"))).toEqual({
      Menu: { x: 1 },
      Upscaling: { upscaleMethod: 3, other: 5 },
    });
    await undo();
    expect(fs.readFileSync(file(), "utf8")).toBe(
      '{"Menu":{"x":1},"Upscaling":{"upscaleMethod":2,"other":5}}',
    );
  });

  it("removes the file for Bottled's defaults, and puts it back on undo", async () => {
    writeUser('{"Menu":{}}');
    const undo = await applyBottledSettings(game, "default");
    expect(fs.existsSync(file())).toBe(false);
    await undo();
    expect(fs.readFileSync(file(), "utf8")).toBe('{"Menu":{}}');
  });

  it("undoing a change on a game without settings file removes the file again", async () => {
    await applyBottledSettings(game, "mortex");
    expect(fs.existsSync(file())).toBe(true);
    await restoreBottledSettings(game);
    expect(fs.existsSync(file())).toBe(false);
    expect(await hasBottledSettingsBackup(game)).toBe(false);
  });

  it("keeps the very first copy when the choice is changed", async () => {
    writeUser('{"original":true}');
    await applyBottledSettings(game, "mortex");
    await applyBottledSettings(game, "default");
    await restoreBottledSettings(game);
    expect(fs.readFileSync(file(), "utf8")).toBe('{"original":true}');
  });
});
