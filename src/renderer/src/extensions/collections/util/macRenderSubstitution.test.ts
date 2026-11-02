import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ICollection, ICollectionMod, ICollectionModRule } from "../types/ICollection";
import {
  BOTTLED_MOD_ID,
  BOTTLED_TAG,
  latestBottledFile,
  latestMainFile,
  resetBottledCache,
  substituteCollection,
  substituteRenderMods,
} from "./macRenderSubstitution";

const nexusMod = (name: string, modId: number, extra: Partial<ICollectionMod> = {}) =>
  ({
    name,
    version: "1.0.0",
    optional: false,
    domainName: "skyrimspecialedition",
    source: { type: "nexus", modId, fileId: modId * 10, tag: `tag-${modId}`, md5: `md5-${modId}` },
    ...extra,
  }) as ICollectionMod;

const ref = (modId: number) => ({ tag: `tag-${modId}` }) as ICollectionModRule["source"];

const rule = (type: ICollectionModRule["type"], source: number, reference: number) =>
  ({ type, source: ref(source), reference: ref(reference) }) as ICollectionModRule;

const collection = (): ICollection =>
  ({
    info: { name: "Test" },
    mods: [
      nexusMod("SKSE", 30379),
      nexusMod("Community Shaders", 86492, { phase: 2, optional: false }),
      nexusMod("Grass Collision", 87816),
      nexusMod("Screen Space GI", 130375),
      nexusMod("Skylighting", 139352),
      nexusMod("Dynamic Terrain Deformation", 99999),
      nexusMod("Water Effects", 112762),
      nexusMod("Some Weather", 1234),
    ],
    modRules: [
      rule("after", 86492, 30379),
      rule("before", 1234, 86492),
      rule("after", 87816, 86492),
      rule("after", 1234, 139352),
      rule("after", 86492, 86492),
    ],
  }) as ICollection;

const BOTTLED = { fileId: 777, version: "1.0.25" };

describe("substituteCollection", () => {
  it("replaces Community Shaders by Bottled Shaders, in the same place and phase", () => {
    const result = substituteCollection(collection(), BOTTLED);
    const bottled = result?.mods.find((mod) => mod.source.modId === BOTTLED_MOD_ID);
    expect(result?.mods.indexOf(bottled as ICollectionMod)).toBe(1);
    expect(bottled).toMatchObject({
      name: "Bottled Shaders",
      version: "1.0.25",
      phase: 2,
      domainName: "skyrimspecialedition",
      source: {
        type: "nexus",
        modId: BOTTLED_MOD_ID,
        fileId: 777,
        updatePolicy: "latest",
        tag: BOTTLED_TAG,
      },
    });
    expect(result?.mods.some((mod) => mod.source.modId === 86492)).toBe(false);
    // rien du Community Shaders d'origine ne doit rester sur le nouveau membre
    expect(bottled?.source.md5).toBeUndefined();
    expect(bottled?.source.logicalFilename).toBeUndefined();
  });

  it("sets aside the feature mods Bottled already includes and Dynamic Terrain Deformation", () => {
    const result = substituteCollection(collection(), BOTTLED);
    expect(result?.mods.map((mod) => mod.name)).toEqual([
      "SKSE",
      "Bottled Shaders",
      "Some Weather",
    ]);
    expect(result?.mortexSubstitution?.removed).toEqual([
      { name: "Grass Collision", modId: 87816, reason: "feature" },
      { name: "Screen Space GI", modId: 130375, reason: "feature" },
      { name: "Skylighting", modId: 139352, reason: "feature" },
      { name: "Dynamic Terrain Deformation", modId: 99999, reason: "incompatible" },
      { name: "Water Effects", modId: 112762, reason: "feature" },
    ]);
    expect(result?.mortexSubstitution?.replaced).toEqual({
      name: "Community Shaders",
      version: "1.0.0",
      modId: 86492,
    });
  });

  it("recognises a feature mod by its name when its id is not in the list", () => {
    const input = collection();
    input.mods.push(nexusMod("Terrain Blending", 555555), nexusMod("Terrain Shadows - Extra", 6));
    const names = substituteCollection(input, BOTTLED)?.mortexSubstitution?.removed.map(
      (mod) => mod.name,
    );
    expect(names).toContain("Terrain Blending");
    expect(names).not.toContain("Some Weather");
  });

  it("points the rules about Community Shaders at Bottled, and drops the ones about removed mods", () => {
    const result = substituteCollection(collection(), BOTTLED);
    expect(result?.modRules).toHaveLength(2);
    const [first, second] = result?.modRules ?? [];
    expect(first.source.tag).toBe(BOTTLED_TAG);
    expect(first.reference.tag).toBe("tag-30379");
    expect(second.source.tag).toBe("tag-1234");
    expect(second.reference.tag).toBe(BOTTLED_TAG);
  });

  it("leaves a collection without Community Shaders alone", () => {
    const input = collection();
    input.mods = input.mods.filter((mod) => mod.source.modId !== 86492);
    expect(substituteCollection(input, BOTTLED)).toBeUndefined();
  });

  it("leaves other games and other sources alone", () => {
    const input = collection();
    input.mods = [
      nexusMod("Community Shaders", 86492, { domainName: "fallout4" }),
      nexusMod("Skylighting", 139352, { source: { type: "browse", url: "https://x" } }),
    ];
    expect(substituteCollection(input, BOTTLED)).toBeUndefined();
  });

  it("does not alter the collection it is given", () => {
    const input = collection();
    const copy = JSON.stringify(input);
    substituteCollection(input, BOTTLED);
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe("latestMainFile", () => {
  it("takes the most recent main file, whatever the order", () => {
    expect(
      latestMainFile([
        { file_id: 1, version: "1.0.13", category_id: 1, uploaded_timestamp: 100 },
        { file_id: 3, version: "1.0.25", category_id: 1, uploaded_timestamp: 300 },
        { file_id: 4, version: "9", category_id: 2, uploaded_timestamp: 400 },
        { file_id: 2, version: "1.0.20", category_name: "MAIN", uploaded_timestamp: 200 },
      ]),
    ).toEqual({ fileId: 3, version: "1.0.25" });
  });

  it("is undefined without a main file", () => {
    expect(latestMainFile([{ file_id: 4, category_id: 2 }])).toBeUndefined();
    expect(latestMainFile([])).toBeUndefined();
  });
});

describe("substituteRenderMods", () => {
  const files = [{ file_id: 777, version: "1.0.25", category_id: 1, uploaded_timestamp: 1 }];

  const makeApi = (
    options: { enabled?: boolean; answer?: unknown; mods?: Record<string, unknown> } = {},
  ) => {
    const { enabled = true, answer = [files], mods = {} } = options;
    return {
      getState: () => ({
        settings: {
          collections: { macRenderSubstitution: enabled },
          profiles: { activeProfileId: "p1" },
        },
        persistent: { profiles: { p1: { gameId: "skyrimse" } }, mods: { skyrimse: mods } },
      }),
      emitAndAwait: vi.fn().mockResolvedValue(answer),
      sendNotification: vi.fn(),
    } as any;
  };

  const platform = Object.getOwnPropertyDescriptor(process, "platform") as PropertyDescriptor;
  const setPlatform = (value: string) =>
    Object.defineProperty(process, "platform", { ...platform, value });

  beforeEach(() => {
    resetBottledCache();
    setPlatform("darwin");
  });
  afterEach(() => Object.defineProperty(process, "platform", platform));

  it("substitutes when the setting is on", async () => {
    const api = makeApi();
    const result = await substituteRenderMods(api, collection());
    expect(result?.mortexSubstitution?.bottled.fileId).toBe(777);
    expect(api.emitAndAwait).toHaveBeenCalledWith("get-mod-files", "skyrimse", BOTTLED_MOD_ID);
  });

  it("does nothing when the setting is off", async () => {
    const api = makeApi({ enabled: false });
    expect(await substituteRenderMods(api, collection())).toBeUndefined();
    expect(api.emitAndAwait).not.toHaveBeenCalled();
  });

  it("does nothing outside macOS", async () => {
    setPlatform("win32");
    const api = makeApi();
    expect(await substituteRenderMods(api, collection())).toBeUndefined();
    expect(api.emitAndAwait).not.toHaveBeenCalled();
  });

  it("does not ask Nexus for a collection without Community Shaders", async () => {
    const api = makeApi();
    const input = collection();
    input.mods = input.mods.filter((mod) => mod.source.modId !== 86492);
    expect(await substituteRenderMods(api, input)).toBeUndefined();
    expect(api.emitAndAwait).not.toHaveBeenCalled();
  });

  it("keeps the collection and says so once when Nexus gives no answer", async () => {
    const api = makeApi({ answer: [[]] });
    expect(await substituteRenderMods(api, collection())).toBeUndefined();
    expect(await substituteRenderMods(api, collection())).toBeUndefined();
    expect(api.sendNotification).toHaveBeenCalledTimes(1);
    expect(api.sendNotification.mock.calls[0][0]).toMatchObject({ type: "warning" });
  });

  it("does not remember a failed lookup", async () => {
    const api = makeApi({ answer: [[]] });
    await substituteRenderMods(api, collection());
    api.emitAndAwait.mockResolvedValue([files]);
    expect((await substituteRenderMods(api, collection()))?.mortexSubstitution).toBeDefined();
  });

  it("asks Nexus once per session", async () => {
    const api = makeApi();
    await Promise.all([latestBottledFile(api), latestBottledFile(api)]);
    await latestBottledFile(api);
    expect(api.emitAndAwait).toHaveBeenCalledTimes(1);
  });

  it("respects a collection the player kept as it was", async () => {
    const api = makeApi({
      mods: {
        col1: {
          id: "col1",
          type: "collection",
          installationPath: "My collection",
          attributes: { mortexSubstitutionOff: true },
        },
      },
    });
    expect(
      await substituteRenderMods(api, collection(), "/staging/My collection/collection.json"),
    ).toBeUndefined();
    expect(
      (await substituteRenderMods(api, collection(), "/staging/Other/collection.json"))
        ?.mortexSubstitution,
    ).toBeDefined();
  });
});
