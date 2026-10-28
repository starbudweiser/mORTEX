import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INI_FILE_NAMES,
  type IIniFile,
  type IniRole,
  applyChanges,
  loadSkyrimIniFiles,
  planChanges,
  readEffective,
  settingId,
} from "./iniEdit";

const file = (role: IniRole, text: string): IIniFile => ({
  role,
  path: `/bottle/${INI_FILE_NAMES[role]}`,
  text,
});

describe("iniEdit", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-iniedit-"));
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const write = (role: IniRole, text: string | Buffer) =>
    fs.writeFileSync(path.join(tmp, INI_FILE_NAMES[role]), text);
  const read = (role: IniRole) => fs.readFileSync(path.join(tmp, INI_FILE_NAMES[role]));

  describe("readEffective", () => {
    it("takes Custom over Prefs over Skyrim.ini and names the file", () => {
      const effective = readEffective([
        file("ini", "[Display]\niSize W=1\niShadowMapResolution=512\nfFoo=ini\n"),
        file("prefs", "[Display]\niShadowMapResolution=2048\nfFoo=prefs\n"),
        file("custom", "[Display]\nfFoo=custom\n"),
      ]);
      const foo = effective.get(settingId("Display", "fFoo"));
      expect(foo).toMatchObject({ value: "custom", role: "custom" });
      expect(foo?.shadowed.map((s) => [s.role, s.value])).toEqual([
        ["prefs", "prefs"],
        ["ini", "ini"],
      ]);
      expect(effective.get(settingId("Display", "iShadowMapResolution"))).toMatchObject({
        value: "2048",
        role: "prefs",
      });
      expect(effective.get(settingId("Display", "iSize W"))).toMatchObject({
        value: "1",
        role: "ini",
      });
    });

    it("ignores the case of sections and keys across files", () => {
      const effective = readEffective([
        file("ini", "[LOD]\nfLODFadeOutMultObjects=5\n"),
        file("prefs", "[lod]\nFLODFADEOUTMULTOBJECTS=15\n"),
      ]);
      expect(effective.size).toBe(1);
      expect(effective.get(settingId("LOD", "fLODFadeOutMultObjects"))).toMatchObject({
        value: "15",
        role: "prefs",
        key: "FLODFADEOUTMULTOBJECTS",
      });
    });

    it("keeps the first of two identical keys", () => {
      const effective = readEffective([
        file("ini", "[General]\nsLanguage=FRENCH\nsLanguage=ENGLISH\n"),
      ]);
      expect(effective.get(settingId("General", "sLanguage"))?.value).toBe("FRENCH");
    });

    it("skips comments, strips trailing comments and reads through a BOM and CRLF", () => {
      const effective = readEffective([
        file(
          "ini",
          "﻿; header\r\n# note\r\n[Display]\r\n;iFake=1\r\n#iOther=2\r\nbFull Screen=0 ; windowed\r\nsPath=a b\\c\r\n",
        ),
      ]);
      expect([...effective.values()].map((s) => [s.key, s.value])).toEqual([
        ["bFull Screen", "0"],
        ["sPath", "a b\\c"],
      ]);
    });
  });

  describe("planChanges", () => {
    it("modifies the file that already carries the effective value", () => {
      const files = [
        file("ini", "[Display]\niShadowMapResolution=512\n"),
        file("prefs", "[Display]\niShadowMapResolution=1024\n"),
      ];
      const plan = planChanges(files, [
        { section: "Display", key: "iShadowMapResolution", value: "2048" },
      ]);
      expect(plan.changes).toEqual([
        {
          path: "/bottle/SkyrimPrefs.ini",
          role: "prefs",
          section: "Display",
          key: "iShadowMapResolution",
          oldValue: "1024",
          newValue: "2048",
          action: "modify",
          createsSection: false,
          line: 2,
          oldLine: "iShadowMapResolution=1024",
          newLine: "iShadowMapResolution=2048",
        },
      ]);
      expect(plan.files.map((f) => f.role)).toEqual(["prefs"]);
    });

    it("writes into Custom only when the value is already there", () => {
      const files = [
        file("custom", "[Display]\nfGamma=1.0\n"),
        file("prefs", "[Display]\nfGamma=1.2\niSize H=1080\n"),
        file("ini", "[General]\n"),
      ];
      const plan = planChanges(files, [
        { section: "Display", key: "fGamma", value: "1.5" },
        { section: "Display", key: "iSize H", value: "1440" },
        { section: "Display", key: "fNew", value: "1" },
        { section: "General", key: "sNew", value: "x" },
      ]);
      expect(plan.changes.map((c) => [c.key, c.role])).toEqual([
        ["fGamma", "custom"],
        ["iSize H", "prefs"],
        ["fNew", "prefs"],
        ["sNew", "ini"],
      ]);
    });

    it("sends a new value to Prefs for graphics sections and Skyrim.ini otherwise", () => {
      const files = [file("prefs", ""), file("ini", ""), file("custom", "")];
      const plan = planChanges(files, [
        { section: "Grass", key: "iMinGrassSize", value: "80" },
        { section: "imagespace", key: "bDoDepthOfField", value: "0" },
        { section: "Water", key: "bUseWaterReflections", value: "1" },
        { section: "Archive", key: "sResourceArchiveList", value: "a.bsa" },
        { section: "Papyrus", key: "bEnableLogging", value: "1" },
      ]);
      expect(plan.changes.map((c) => [c.section, c.role])).toEqual([
        ["Grass", "prefs"],
        ["imagespace", "prefs"],
        ["Water", "prefs"],
        ["Archive", "ini"],
        ["Papyrus", "ini"],
      ]);
    });

    it("skips values that are already effective", () => {
      const files = [file("prefs", "[Display]\nfGamma=1.2\n")];
      const plan = planChanges(files, [{ section: "display", key: "FGAMMA", value: "1.2" }]);
      expect(plan.changes).toEqual([]);
      expect(plan.files).toEqual([]);
    });

    it("keeps only the last of two changes to the same setting", () => {
      const plan = planChanges(
        [file("prefs", "[Display]\nfGamma=1.2\n")],
        [
          { section: "Display", key: "fGamma", value: "1.3" },
          { section: "DISPLAY", key: "fgamma", value: "1.4" },
        ],
      );
      expect(plan.changes.map((c) => c.newValue)).toEqual(["1.4"]);
    });

    it("fails when the target file is not provided", () => {
      expect(() =>
        planChanges([file("ini", "")], [{ section: "Display", key: "fGamma", value: "1" }]),
      ).toThrow("SkyrimPrefs.ini");
    });

    it("adds a key at the end of its section, in the file's separator style", () => {
      const tight = planChanges(
        [file("prefs", "[Display]\nfA=1\n; note\nfB=2\n\n[Audio]\nfC=3\n")],
        [{ section: "Display", key: "fNew", value: "9" }],
      );
      expect(tight.changes[0]).toMatchObject({ action: "add", line: 5, newLine: "fNew=9" });

      const spaced = planChanges(
        [file("prefs", "[Display]\nfA = 1\n")],
        [{ section: "Display", key: "fNew", value: "9" }],
      );
      expect(spaced.changes[0].newLine).toBe("fNew = 9");
    });
  });

  describe("applyChanges", () => {
    const run = async (changes: Parameters<typeof planChanges>[1]) => {
      const files = await loadSkyrimIniFiles(tmp);
      return applyChanges(planChanges(files, changes));
    };

    it("touches only the modified line, keeping comments, order, case and CRLF", async () => {
      const original =
        "; mORTEX\r\n[Display]\r\n# keep me\r\nFGamma = 1.2 ; tweak\r\niSize W=1920\r\n\r\n[Audio]\r\nfMusic=1\r\n";
      write("prefs", original);
      const written = await run([{ section: "display", key: "fgamma", value: "1.5" }]);
      expect(written).toEqual([path.join(tmp, "SkyrimPrefs.ini")]);
      expect(read("prefs").toString()).toBe(original.replace("1.2 ;", "1.5 ;"));
    });

    it("keeps the BOM and does not touch other files", async () => {
      write("prefs", "﻿[Display]\r\nfGamma=1.2\r\n");
      write("ini", "[General]\nsLanguage=FRENCH\n");
      await run([{ section: "Display", key: "fGamma", value: "1.5" }]);
      const bytes = read("prefs");
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(bytes.toString("utf8")).toBe("﻿[Display]\r\nfGamma=1.5\r\n");
      expect(read("ini").toString()).toBe("[General]\nsLanguage=FRENCH\n");
    });

    it("ignores a keyless first line under a BOM and still creates the section", async () => {
      write("ini", "﻿fFirst=1\n");
      await run([{ section: "General", key: "sNew", value: "x" }]);
      expect(read("ini").toString()).toBe("﻿fFirst=1\n\n[General]\nsNew=x\n");
    });

    it("creates a missing section at the end, with the file's line endings", async () => {
      write("ini", "[General]\r\nsLanguage=FRENCH\r\n");
      await run([
        { section: "Papyrus", key: "bEnableLogging", value: "1" },
        { section: "papyrus", key: "bEnableTrace", value: "1" },
      ]);
      expect(read("ini").toString()).toBe(
        "[General]\r\nsLanguage=FRENCH\r\n\r\n[Papyrus]\r\nbEnableLogging=1\r\nbEnableTrace=1\r\n",
      );
    });

    it("adds the section after a last line without line ending", async () => {
      write("ini", "[General]\nsLanguage=FRENCH");
      await run([{ section: "Papyrus", key: "bEnableLogging", value: "1" }]);
      expect(read("ini").toString()).toBe(
        "[General]\nsLanguage=FRENCH\n\n[Papyrus]\nbEnableLogging=1",
      );
    });

    it("adds a key to a section without keys, before the next section", async () => {
      write("prefs", "[Display]\n; nothing yet\n\n[Audio]\nfMusic=1\n");
      await run([{ section: "Display", key: "fGamma", value: "1" }]);
      expect(read("prefs").toString()).toBe(
        "[Display]\nfGamma=1\n; nothing yet\n\n[Audio]\nfMusic=1\n",
      );
    });

    it("creates a missing file", async () => {
      await run([{ section: "Display", key: "fGamma", value: "1" }]);
      expect(read("prefs").toString()).toBe("[Display]\r\nfGamma=1\r\n");
    });

    it("modifies only the first of two duplicated keys", async () => {
      write("ini", "[General]\nsLanguage=FRENCH\nsLanguage=ENGLISH\n");
      await run([{ section: "General", key: "sLanguage", value: "SPANISH" }]);
      expect(read("ini").toString()).toBe("[General]\nsLanguage=SPANISH\nsLanguage=ENGLISH\n");
    });

    it("rewrites a value in the file that carries it despite a different key case", async () => {
      write("custom", "[Display]\nFGamma=1.0\n");
      write("prefs", "[Display]\nfgamma=1.2\n");
      await run([{ section: "Display", key: "fGamma", value: "1.5" }]);
      expect(read("custom").toString()).toBe("[Display]\nFGamma=1.5\n");
      expect(read("prefs").toString()).toBe("[Display]\nfgamma=1.2\n");
    });

    it("round-trips non-UTF-8 files byte for byte", async () => {
      const bytes = Buffer.concat([
        Buffer.from("[General]\nsTitle=caf"),
        Buffer.from([0xe9]),
        Buffer.from("\nsLanguage=FRENCH\n"),
      ]);
      write("ini", bytes);
      await run([{ section: "General", key: "sLanguage", value: "ENGLISH" }]);
      expect(read("ini")).toEqual(
        Buffer.from(bytes.toString("latin1").replace("FRENCH", "ENGLISH"), "latin1"),
      );
    });

    it("refuses to write when a file changed after the plan, and writes nothing", async () => {
      write("prefs", "[Display]\nfGamma=1.2\n");
      write("ini", "[General]\nsLanguage=FRENCH\n");
      const plan = planChanges(await loadSkyrimIniFiles(tmp), [
        { section: "Display", key: "fGamma", value: "1.5" },
        { section: "General", key: "sLanguage", value: "ENGLISH" },
      ]);
      write("ini", "[General]\nsLanguage=FRENCH\nbExtra=1\n");
      await expect(applyChanges(plan)).rejects.toThrow("Skyrim.ini");
      expect(read("prefs").toString()).toBe("[Display]\nfGamma=1.2\n");
    });
  });
});
