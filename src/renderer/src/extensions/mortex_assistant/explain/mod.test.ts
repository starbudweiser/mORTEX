import { describe, expect, it } from "vitest";

import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { classifyFile, explainMod, type IModExplainEnv, type IModConflict } from "./mod";
import { needsLootAttribution } from "./types";

const rule = (type: string, id: string): IModRule =>
  ({ type, reference: { id } }) as unknown as IModRule;

const mod = (id: string, rules: IModRule[] = [], source?: string): IMod =>
  ({ id, type: "", state: "installed", rules, attributes: { source } }) as unknown as IMod;

const conflict = (id: string, files: string[]): IModConflict => ({
  otherMod: { id, name: id.toUpperCase() },
  files,
  suggestion: null,
});

const env = (over: Partial<IModExplainEnv> = {}): IModExplainEnv => ({
  conflicts: {},
  mods: {},
  nexus: { loggedIn: true, checked: true },
  plugins: [],
  ...over,
});

describe("classifyFile", () => {
  it.each([
    ["Scripts/Source/Foo.psc", "scripts"],
    ["scripts/foo.pex", "scripts"],
    ["Foo.esp", "plugins"],
    ["SKSE/Plugins/Foo.dll", "skse"],
    ["Interface/foo.swf", "interface"],
    ["textures/a/b.dds", "textures"],
    ["meshes/a.nif", "meshes"],
    ["sound/fx/a.xwm", "sounds"],
    ["Foo.ini", "ini"],
    ["readme.txt", "other"],
  ])("%s -> %s", (file, cls) => {
    expect(classifyFile(file)).toBe(cls);
  });
});

describe("explainMod: conflits", () => {
  it("conflit de scripts sans règle : ordre non défini, avertissement", () => {
    const a = mod("a");
    const items = explainMod(
      a,
      env({
        conflicts: { a: [conflict("b", ["scripts/x.pex", "scripts/y.pex"])] },
        mods: { a, b: mod("b") },
      }),
    );
    const item = items.find((i) => i.kind === "mod-conflict")!;
    expect(item.severity).toBe("warning");
    expect(item.textKey).toContain("No rule");
    expect(item.params).toMatchObject({ mod: "B", count: 2 });
    expect(item.details?.[0].params).toMatchObject({ label: "Scripts", count: 2 });
    expect(item.actions?.[0].id).toBe("open-conflict-editor");
    expect(needsLootAttribution(items)).toBe(false);
  });

  it("conflit de textures avec règle : information et gagnant connu", () => {
    const a = mod("a", [rule("before", "b")]);
    const b = mod("b");
    const items = explainMod(
      a,
      env({
        conflicts: { a: [conflict("b", ["textures/t.dds"])] },
        mods: { a, b },
      }),
    );
    const item = items.find((i) => i.kind === "mod-conflict")!;
    expect(item.severity).toBe("info");
    expect(item.textKey).toContain("makes {{mod}} win");
    expect(item.sources.map((s) => s.kind)).toEqual(["conflict", "mod-rule"]);
  });

  it("la règle de l'autre mod compte aussi, et une règle 'after' donne la victoire à son propriétaire", () => {
    const a = mod("a");
    const b = mod("b", [rule("after", "a")]);
    const [item] = explainMod(
      a,
      env({ conflicts: { a: [conflict("b", ["meshes/m.nif"])] }, mods: { a, b } }),
    ).filter((i) => i.kind === "mod-conflict");
    expect(item.textKey).toContain("makes {{mod}} win");
  });

  it("conflits non calculés, ou absents", () => {
    expect(explainMod(mod("a"), env({ conflicts: undefined }))[0].id).toBe("conflicts-unknown");
    expect(explainMod(mod("a"), env({ conflicts: {} }))[0].id).toBe("conflicts-none");
  });
});

describe("explainMod: Nexus et plugins", () => {
  it("sans connexion Nexus : non vérifié", () => {
    const items = explainMod(
      mod("a", [], "nexus"),
      env({ nexus: { loggedIn: false, checked: false } }),
    );
    const item = items.find((i) => i.kind === "mod-nexus-requirement")!;
    expect(item.titleKey).toBe("Nexus requirements not verified");
    expect(item.textKey).toContain("Nexus connection is required");
  });

  it("exigence manquante lue dans le health check", () => {
    const items = explainMod(
      mod("a", [], "nexus"),
      env({
        nexus: {
          loggedIn: true,
          checked: true,
          requirements: {
            missingMods: [{ uid: "u1", modName: "SKSE64", modUrl: "https://x" }],
            dlcRequirements: [],
          } as never,
        },
      }),
    );
    const item = items.find((i) => i.id === "nexus:u1")!;
    expect(item.severity).toBe("warning");
    expect(item.sources[0].url).toBe("https://x");
  });

  it("plugins du mod avec un problème LOOT", () => {
    const items = explainMod(
      mod("a"),
      env({
        plugins: [
          { name: "a.esp", messages: [{ type: 1 }] },
          { name: "b.esp", messages: [] },
        ],
      }),
    );
    const item = items.find((i) => i.kind === "mod-plugins")!;
    expect(item.params).toMatchObject({ count: 1, names: "a.esp" });
    expect(needsLootAttribution(items)).toBe(true);
  });
});
