import { describe, expect, it } from "vitest";

import { TAB_GROUPS } from "./groups";
import { SKYRIMSE_CATALOG } from "./skyrimse";
import type { TabId } from "./types";

describe("groupes de réglages", () => {
  it("places every catalog setting in exactly one group of its own tab", () => {
    const seen = new Map<string, string>();
    for (const [tab, groups] of Object.entries(TAB_GROUPS) as [
      TabId,
      (typeof TAB_GROUPS)[TabId],
    ][]) {
      for (const group of groups) {
        for (const id of group.ids) {
          expect(seen.has(id), `${id} listé deux fois`).toBe(false);
          seen.set(id, tab);
        }
      }
    }
    const misplaced = SKYRIMSE_CATALOG.filter((s) => seen.get(s.id) !== s.tab).map((s) => s.id);
    expect(misplaced).toEqual([]);
    expect(seen.size).toBe(SKYRIMSE_CATALOG.length);
  });

  it("has unique group ids", () => {
    const ids = Object.values(TAB_GROUPS).flatMap((groups) => groups.map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
