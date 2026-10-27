import { describe, expect, it } from "vitest";

import { moveBefore, sortByOrder } from "./menuOrder";

describe("sidebar order", () => {
  it("follows the saved order and keeps new pages at the end", () => {
    const pages = ["Mods", "Plugins", "Profiles", "New page"];
    expect(sortByOrder(pages, (id) => id, ["Profiles", "Mods", "Plugins"])).toEqual([
      "Profiles",
      "Mods",
      "Plugins",
      "New page",
    ]);
    expect(sortByOrder(pages, (id) => id, undefined)).toBe(pages);
  });

  it("moves an entry onto another, up or down", () => {
    const ids = ["a", "b", "c", "d"];
    expect(moveBefore(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveBefore(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveBefore(ids, "a", "a")).toBe(ids);
  });
});
