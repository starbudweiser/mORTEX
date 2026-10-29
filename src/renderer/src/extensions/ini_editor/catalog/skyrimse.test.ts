import { describe, expect, it } from "vitest";

import { EXE_SETTINGS } from "./exeSettings";
import { SKYRIMSE_CATALOG, settingsOfTab } from "./skyrimse";

const settingId = (section: string, key: string) => `${section}\0${key}`.toLowerCase();
const inExe = new Set(EXE_SETTINGS.map(([section, key]) => settingId(section, key)));

describe("catalogue Skyrim SE", () => {
  it("has about a hundred and twenty settings", () => {
    expect(SKYRIMSE_CATALOG.length).toBeGreaterThanOrEqual(110);
    expect(SKYRIMSE_CATALOG.length).toBeLessThanOrEqual(150);
  });

  it("names every setting the way SkyrimSE.exe does, unless marked outsideExe", () => {
    const unknown = SKYRIMSE_CATALOG.filter(
      (s) => !s.outsideExe && !inExe.has(settingId(s.section, s.key)),
    ).map((s) => `${s.key}:${s.section}`);
    expect(unknown).toEqual([]);
  });

  it("marks outsideExe only for names really absent from the exe", () => {
    const wrong = SKYRIMSE_CATALOG.filter(
      (s) => s.outsideExe && inExe.has(settingId(s.section, s.key)),
    ).map((s) => `${s.key}:${s.section}`);
    expect(wrong).toEqual([]);
  });

  it("has unique ids and unique section/key pairs", () => {
    const ids = SKYRIMSE_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pairs = SKYRIMSE_CATALOG.map((s) => settingId(s.section, s.key));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("prefixes each key with its type, like Bethesda's names", () => {
    const prefix = { bool: "b", int: "iu", float: "f", choice: "iufs", text: "s" } as const;
    const wrong = SKYRIMSE_CATALOG.filter((s) => !prefix[s.type].includes(s.key[0])).map(
      (s) => s.key,
    );
    expect(wrong).toEqual([]);
  });

  it("gives numbers sensible bounds and choices their options", () => {
    for (const s of SKYRIMSE_CATALOG) {
      if (s.type === "int" || s.type === "float") {
        expect(s.min, s.id).toBeDefined();
        expect(s.max, s.id).toBeDefined();
        expect(s.min!, s.id).toBeLessThan(s.max!);
        expect(s.step, s.id).toBeGreaterThan(0);
      }
      if (s.type === "choice") expect(s.options?.length, s.id).toBeGreaterThan(1);
    }
  });

  it("only depends on existing settings", () => {
    const ids = new Set(SKYRIMSE_CATALOG.map((s) => s.id));
    for (const s of SKYRIMSE_CATALOG) {
      if (s.dependsOn) expect(ids.has(s.dependsOn.on), `${s.id} → ${s.dependsOn.on}`).toBe(true);
      expect(s.dependsOn?.on).not.toBe(s.id);
    }
  });

  it("fills every tab", () => {
    for (const tab of [
      "display",
      "shadows",
      "distance",
      "grassLod",
      "waterFx",
      "interface",
      "game",
      "camera",
      "audio",
    ] as const) {
      expect(settingsOfTab(tab).length, tab).toBeGreaterThan(0);
    }
  });
});
