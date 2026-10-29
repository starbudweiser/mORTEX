import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readBethesdaValues } from "./bethesdaPresets";

describe("readBethesdaValues", () => {
  let game: string;

  beforeEach(() => {
    game = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-presets-"));
  });

  afterEach(() => fs.rmSync(game, { recursive: true, force: true }));

  it("reads the defaults, the four presets and the launcher template", async () => {
    fs.mkdirSync(path.join(game, "Skyrim"));
    fs.writeFileSync(path.join(game, "Skyrim_Default.ini"), "[General]\r\nsLanguage=ENGLISH\r\n");
    fs.writeFileSync(
      path.join(game, "Skyrim", "SkyrimPrefs.ini"),
      "[Display]\r\nfGamma=1.0000\r\n",
    );
    fs.writeFileSync(
      path.join(game, "Ultra.ini"),
      "[Display]\r\niShadowMapResolution=4096\r\nfShadowDistance=10000\r\n[Grass]\r\n; comment\r\nfGrassStartFadeDistance=7000\r\n",
    );
    fs.writeFileSync(path.join(game, "Low.ini"), "[Display]\r\niShadowMapResolution=512\r\n");

    const values = await readBethesdaValues(game);

    expect(values.defaults).toEqual([{ section: "General", key: "sLanguage", value: "ENGLISH" }]);
    expect(values.launcherPrefs).toEqual([{ section: "Display", key: "fGamma", value: "1.0000" }]);
    expect(values.presets.ultra).toEqual([
      { section: "Display", key: "iShadowMapResolution", value: "4096" },
      { section: "Display", key: "fShadowDistance", value: "10000" },
      { section: "Grass", key: "fGrassStartFadeDistance", value: "7000" },
    ]);
    expect(values.presets.low).toHaveLength(1);
  });

  it("gives empty lists for missing files", async () => {
    const values = await readBethesdaValues(game);
    expect(values.defaults).toEqual([]);
    expect(values.launcherPrefs).toEqual([]);
    expect(values.presets).toEqual({ low: [], medium: [], high: [], ultra: [] });
  });
});
