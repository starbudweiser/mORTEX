import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSkyrimIniFiles } from "../../util/macos/iniEdit";
import {
  BACKUPS_DIRNAME,
  backupName,
  listBackups,
  restoreBackup,
  restoreBackupSafely,
} from "./backup";
import { SettingsSaveError, commitSave, formatSummary, previewSave, summarizePlan } from "./save";

describe("enregistrement des réglages", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-save-"));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const file = (name: string) => path.join(dir, name);
  const read = (name: string) => fs.readFileSync(file(name), "utf8");
  const plan = async (changes: Parameters<typeof previewSave>[1]) =>
    previewSave(await loadSkyrimIniFiles(dir), changes);

  it("names backups after the local time, to the second", () => {
    expect(backupName(new Date(2026, 9, 29, 21, 5, 3))).toBe("2026-10-29 21.05.03");
  });

  it("summarizes the plan file by file, with old and new values", async () => {
    fs.writeFileSync(file("SkyrimPrefs.ini"), "[Display]\r\niShadowMapResolution=2048\r\n");
    fs.writeFileSync(file("Skyrim.ini"), "[General]\r\nsLanguage=FRENCH\r\n");
    const summary = summarizePlan(
      await plan([
        { section: "Display", key: "iShadowMapResolution", value: "4096" },
        { section: "Papyrus", key: "bEnableLogging", value: "1" },
      ]),
    );
    expect(summary.map((s) => s.name)).toEqual(["SkyrimPrefs.ini", "Skyrim.ini"]);
    expect(summary[0].changes[0]).toMatchObject({ oldValue: "2048", newValue: "4096" });
    expect(summary[1].changes[0]).toMatchObject({ createsSection: true, newValue: "1" });
  });

  it("backs the files up, then writes only the planned lines", async () => {
    const original = "; note\r\n[Display]\r\niShadowMapResolution=2048\r\nfGamma=1.0000\r\n";
    fs.writeFileSync(file("SkyrimPrefs.ini"), original);
    const result = await commitSave(
      await plan([{ section: "Display", key: "iShadowMapResolution", value: "4096" }]),
    );

    expect(read("SkyrimPrefs.ini")).toBe(original.replace("2048", "4096"));
    expect(path.dirname(result.backup.dir)).toBe(path.join(dir, BACKUPS_DIRNAME));
    expect(fs.readFileSync(path.join(result.backup.dir, "SkyrimPrefs.ini"), "utf8")).toBe(original);
    expect(result.written).toEqual([file("SkyrimPrefs.ini")]);
  });

  it("undoes a save by restoring the backup, and removes the files it created", async () => {
    const original = "[Display]\r\nfGamma=1.0000\r\n";
    fs.writeFileSync(file("SkyrimPrefs.ini"), original);
    const result = await commitSave(
      await plan([
        { section: "Display", key: "fGamma", value: "1.5" },
        { section: "Papyrus", key: "bEnableLogging", value: "1" },
      ]),
    );
    expect(read("SkyrimPrefs.ini")).toContain("1.5");
    expect(fs.existsSync(file("Skyrim.ini"))).toBe(true);

    await restoreBackup(result.backup.dir);
    expect(read("SkyrimPrefs.ini")).toBe(original);
    expect(fs.existsSync(file("Skyrim.ini"))).toBe(false);
  });

  it("keeps one backup per save, newest first, even within the same second", async () => {
    fs.writeFileSync(file("SkyrimPrefs.ini"), "[Display]\r\nfGamma=1.0000\r\n");
    await commitSave(await plan([{ section: "Display", key: "fGamma", value: "1.1" }]));
    await commitSave(await plan([{ section: "Display", key: "fGamma", value: "1.2" }]));
    const backups = await listBackups(dir);
    expect(backups).toHaveLength(2);
    expect(backups[0].files).toEqual(["SkyrimPrefs.ini"]);
  });

  it("refuses a read-only file and writes nothing", async () => {
    fs.writeFileSync(file("SkyrimPrefs.ini"), "[Display]\r\nfGamma=1.0000\r\n");
    fs.writeFileSync(file("Skyrim.ini"), "[General]\r\nsLanguage=FRENCH\r\n");
    const pending = await plan([
      { section: "Display", key: "fGamma", value: "1.5" },
      { section: "General", key: "sLanguage", value: "ENGLISH" },
    ]);
    fs.chmodSync(file("Skyrim.ini"), 0o444);
    try {
      await expect(commitSave(pending)).rejects.toBeInstanceOf(SettingsSaveError);
      expect(read("SkyrimPrefs.ini")).toContain("1.0000");
      expect(fs.existsSync(path.join(dir, BACKUPS_DIRNAME))).toBe(false);
    } finally {
      fs.chmodSync(file("Skyrim.ini"), 0o644);
    }
  });

  it("writes the summary the way the confirmation box shows it", async () => {
    fs.writeFileSync(file("SkyrimPrefs.ini"), "[Display]\r\niShadowMapResolution=2048\r\n");
    fs.writeFileSync(file("Skyrim.ini"), "[General]\r\nsLanguage=FRENCH\r\n");
    const text = formatSummary(
      summarizePlan(
        await plan([
          { section: "Display", key: "iShadowMapResolution", value: "4096" },
          { section: "Display", key: "fGamma", value: "1.2" },
          { section: "Papyrus", key: "bEnableLogging", value: "1" },
        ]),
      ),
      { unset: "(absent)", newSection: "— nouvelle section" },
    );
    expect(text).toBe(
      [
        "SkyrimPrefs.ini",
        "  [Display] iShadowMapResolution : 2048 → 4096",
        "  [Display] fGamma : (absent) → 1.2",
        "",
        "Skyrim.ini",
        "  [Papyrus] bEnableLogging : (absent) → 1 — nouvelle section",
      ].join("\n"),
    );
  });

  it("restores an older backup after copying the current state, so the restore can be undone", async () => {
    const original = "[Display]\r\nfGamma=1.0000\r\n";
    fs.writeFileSync(file("SkyrimPrefs.ini"), original);
    const first = await commitSave(
      await plan([{ section: "Display", key: "fGamma", value: "1.2" }]),
    );
    const afterFirst = read("SkyrimPrefs.ini");

    const safety = await restoreBackupSafely(first.backup.dir);
    expect(read("SkyrimPrefs.ini")).toBe(original);

    // annuler la restauration : retour à l'état d'avant
    await restoreBackup(safety.dir);
    expect(read("SkyrimPrefs.ini")).toBe(afterFirst);
    expect(await listBackups(dir)).toHaveLength(2);
  });
});
