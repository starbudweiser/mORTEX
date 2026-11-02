import { CycleError } from "@vortex/shared/errors";
import { describe, expect, vi } from "vitest";

import { makeMod, makeReference, makeRule } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import sortMods, { type SortCycleError } from "./sort";

vi.mock("../../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const after = (id: string) =>
  makeRule({ type: "after", reference: { ...makeReference({ tag: undefined }), id } });

describe("sortMods", () => {
  test("gives a usable order when the rules form a loop", async ({ makeApi }) => {
    const h = makeApi();
    Object.assign(h.api, { lookupModMeta: vi.fn().mockResolvedValue([]) });
    const mods = [
      makeMod({ id: "a", rules: [after("c")] }),
      makeMod({ id: "b", rules: [after("a")] }),
      makeMod({ id: "c", rules: [after("b")] }),
      makeMod({ id: "free" }),
    ];

    const err = await sortMods("cycle-game", mods, h.api as unknown as IExtensionApi).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(CycleError);
    expect((err as SortCycleError).cycles).toHaveLength(1);
    expect((err as SortCycleError).fallback.map((mod) => mod.id).toSorted()).toEqual([
      "a",
      "b",
      "c",
      "free",
    ]);
  });
});
