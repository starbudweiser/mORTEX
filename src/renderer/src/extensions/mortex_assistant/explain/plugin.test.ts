import { describe, expect, it } from "vitest";

import type { IPluginCombined } from "../../gamebryo_plugin_management/types/IPlugins";
import { explainPlugin, type IPluginExplainEnv } from "./plugin";
import { needsLootAttribution } from "./types";

const entry = (enabled: boolean, loadOrder = 0) => ({ enabled, loadOrder });

const env = (over: Partial<IPluginExplainEnv> = {}): IPluginExplainEnv => ({
  pluginList: {
    "skyrim.esm": {} as never,
    "dawnguard.esm": {} as never,
    "mod.esp": {} as never,
    "other.esp": {} as never,
  },
  loadOrder: {
    "skyrim.esm": entry(true),
    "dawnguard.esm": entry(true, 1),
    "mod.esp": entry(true, 2),
    "other.esp": entry(true, 3),
  },
  natives: ["skyrim.esm"],
  language: "en",
  ...over,
});

const plugin = (over: Partial<IPluginCombined> = {}): IPluginCombined =>
  ({
    id: "mod.esp",
    name: "mod.esp",
    masterList: ["Skyrim.esm"],
    messages: [],
    dirtyness: [],
    cleanliness: [],
    requirements: [],
    incompatibilities: [],
    suggestedTags: [],
    currentTags: [],
    isValidAsLightPlugin: false,
    isLight: false,
    isMedium: false,
    loadsArchive: false,
    isEmpty: false,
    ...over,
  }) as IPluginCombined;

const ids = (items: ReturnType<typeof explainPlugin>) => items.map((i) => i.id);

describe("explainPlugin", () => {
  it("n'a rien à dire d'un plugin sain", () => {
    expect(explainPlugin(plugin(), env())).toEqual([]);
  });

  it("explique un plugin sale avec ses compteurs et l'outil", () => {
    const items = explainPlugin(
      plugin({
        id: "dawnguard.esm",
        name: "Dawnguard.esm",
        dirtyness: [
          {
            crc: 255,
            itmCount: 4,
            deletedReferenceCount: 2,
            deletedNavmeshCount: 1,
            cleaningUtility: "[SSEEdit](https://example.org/x)",
          },
        ],
      }),
      env(),
    );
    const dirty = items.find((i) => i.kind === "plugin-dirty");
    expect(dirty?.severity).toBe("warning");
    expect(dirty?.params).toMatchObject({ itm: 4, udr: 2, nav: 1, utility: "SSEEdit" });
    expect(dirty?.sources[0]).toMatchObject({ kind: "loot-meta", detail: "CRC FF" });
    expect(needsLootAttribution(items)).toBe(true);
  });

  it("signale un plugin nettoyé", () => {
    const clean = { crc: 1, itmCount: 0, deletedReferenceCount: 0, deletedNavmeshCount: 0 };
    const items = explainPlugin(plugin({ cleanliness: [clean as never] }), env());
    expect(items.map((i) => i.kind)).toEqual(["plugin-clean"]);
  });

  it("signale un master absent comme une erreur", () => {
    const items = explainPlugin(plugin({ masterList: ["Skyrim.esm", "Missing.esm"] }), env());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "plugin-master", severity: "error" });
    expect(items[0].params.master).toBe("Missing.esm");
    expect(items[0].sources[0].kind).toBe("masters");
  });

  it("signale un master installé mais désactivé", () => {
    const e = env();
    e.loadOrder["dawnguard.esm"] = entry(false, 1);
    const [item] = explainPlugin(plugin({ masterList: ["Dawnguard.esm"] }), e);
    expect(item).toMatchObject({ kind: "plugin-master", titleKey: "Disabled master" });
  });

  it("signale une incompatibilité active des deux plugins", () => {
    const inc = [{ name: "other.esp", display: "Other" }];
    const active = explainPlugin(plugin({ incompatibilities: inc }), env());
    expect(active[0]).toMatchObject({ kind: "plugin-incompatible", severity: "error" });
    const e = env();
    e.loadOrder["other.esp"] = entry(false, 3);
    expect(explainPlugin(plugin({ incompatibilities: inc }), e)).toEqual([]);
  });

  it("signale une exigence absente ou inactive", () => {
    const req = [{ name: "gone.esp", display: "Gone" }];
    expect(explainPlugin(plugin({ requirements: req }), env())[0].titleKey).toBe(
      "Missing requirement",
    );
    const e = env();
    e.loadOrder["other.esp"] = entry(false, 3);
    expect(
      explainPlugin(plugin({ requirements: [{ name: "other.esp", display: "Other" }] }), e)[0]
        .titleKey,
    ).toBe("Inactive requirement");
  });

  it("cite les messages LOOT tels quels avec leur type", () => {
    const items = explainPlugin(
      plugin({
        messages: [
          { type: 1, content: [{ text: "Texte exact", language: "en" }], condition: "" },
          { type: 2, content: [{ text: "Grave", language: "en" }], condition: "" },
        ] as never,
      }),
      env(),
    );
    expect(items.map((i) => [i.severity, i.params.quote, i.sources[0].detail])).toEqual([
      ["warning", "Texte exact", "warn"],
      ["error", "Grave", "error"],
    ]);
  });

  it("explique l'absence de métadonnées LOOT, ESL, archive, vide et tags", () => {
    const items = explainPlugin(
      plugin({
        messages: [{ type: -1, content: [{ text: "x", language: "en" }], condition: "" }] as never,
        isValidAsLightPlugin: true,
        loadsArchive: true,
        isEmpty: true,
        suggestedTags: [{ isAddition: true, name: "Delev", condition: "" }] as never,
      }),
      env(),
    );
    expect(items.map((i) => i.kind).sort()).toEqual([
      "plugin-archive",
      "plugin-empty",
      "plugin-esl",
      "plugin-no-metadata",
      "plugin-tags",
    ]);
    expect(ids(items)).toContain("no-metadata");
  });
});
