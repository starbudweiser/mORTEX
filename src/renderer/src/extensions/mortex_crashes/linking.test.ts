import type { CrashEvent } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { buildFileIndex, linkEvent, modAppearance, sortNewestFirst } from "./linking";

const files = buildFileIndex([
  { relPath: "SKSE/Plugins/EngineFixes.dll", source: "engine-fixes-1" },
  { relPath: "SKSE/Plugins/enginefixes.dll", source: "engine-fixes-dup" },
  { relPath: "Cathedral Weathers.esp", source: "cathedral-2" },
]);
const mods = [{ id: "ussep-9", names: ["Unofficial Skyrim Special Edition Patch"] }];

const event = (time: string, names: Array<[string, CrashEvent["suspects"][number]["kind"]]>) =>
  ({
    schema: 1,
    crash_time: time,
    log_name: `${time}.log`,
    game_runtime: "1.6.1170",
    skse_runtime: null,
    verdict: null,
    plugins_hash: null,
    bottle: null,
    suspects: names.map(([name, kind], i) => ({ name, kind, score: 1 - i / 10, reasons: ["r"] })),
  }) as CrashEvent;

describe("linkEvent", () => {
  it("rattache un DLL connu à son mod, tous les candidats listés", () => {
    const [dll] = linkEvent(event("t", [["EngineFixes.dll", "dll"]]), files, mods).suspects;
    expect(dll.status).toBe("mod");
    expect(dll.candidates.map((c) => c.modId).sort()).toEqual([
      "engine-fixes-1",
      "engine-fixes-dup",
    ]);
  });

  it("DLL sans extension, chemin complet et casse différente", () => {
    const suspects = linkEvent(
      event("t", [
        ["EngineFixes", "dll"],
        ["Data\\SKSE\\Plugins\\ENGINEFIXES.DLL", "dll"],
      ]),
      files,
      mods,
    ).suspects;
    expect(suspects.map((s) => s.status)).toEqual(["mod", "mod"]);
  });

  it("suspect hors mORTEX quand aucun fichier déployé ne correspond", () => {
    const [s] = linkEvent(event("t", [["UnknownTool.dll", "dll"]]), files, mods).suspects;
    expect(s.status).toBe("external");
    expect(s.candidates).toEqual([]);
  });

  it("plugin retrouvé, mod retrouvé par son nom, objet et env non rattachés", () => {
    const suspects = linkEvent(
      event("t", [
        ["Cathedral Weathers.esp", "plugin"],
        ["unofficial skyrim special edition patch", "mod"],
        ["meshes/x.nif", "object"],
        ["D3DMetal", "env"],
      ]),
      files,
      mods,
    ).suspects;
    expect(suspects.map((s) => s.status)).toEqual(["mod", "mod", "object", "env"]);
    expect(suspects[1].candidates[0].modId).toBe("ussep-9");
  });

  it("classe les suspects par score décroissant", () => {
    const e = event("t", [
      ["a.dll", "dll"],
      ["b.dll", "dll"],
    ]);
    e.suspects[1].score = 5;
    expect(linkEvent(e, files, mods).suspects.map((s) => s.suspect.name)).toEqual([
      "b.dll",
      "a.dll",
    ]);
  });
});

describe("modAppearance", () => {
  const linked = sortNewestFirst([
    event("2026-10-01", [["EngineFixes.dll", "dll"]]),
    event("2026-10-02", [["Cathedral Weathers.esp", "plugin"]]),
    event("2026-10-03", [
      ["x.dll", "dll"],
      ["EngineFixes.dll", "dll"],
    ]),
  ]).map((e) => linkEvent(e, files, mods));

  it("compte dans combien des derniers plantages le mod apparaît, avec son rang", () => {
    const result = modAppearance("engine-fixes-1", linked);
    expect(result.total).toBe(3);
    expect(result.count).toBe(2);
    expect(result.latest?.rank).toBe(2);
    expect(result.latest?.linked.event.crash_time).toBe("2026-10-03");
  });

  it("mod absent des plantages", () => {
    expect(modAppearance("ussep-9", linked)).toEqual({ total: 3, count: 0 });
  });

  it("limite à la fenêtre des derniers plantages", () => {
    expect(modAppearance("engine-fixes-1", linked, 1).total).toBe(1);
  });
});
