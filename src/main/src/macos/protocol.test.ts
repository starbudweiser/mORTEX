import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { on: vi.fn() } }));

import { mortexAction } from "./protocol";

describe("mortex:// links", () => {
  it("turns Shortcuts links into actions", () => {
    expect(mortexAction("mortex://launch")).toBe("launch");
    expect(mortexAction("mortex://DEPLOY")).toBe("deploy");
    expect(mortexAction("mortex://profile?name=Survie%20hardcore")).toBe("profile:Survie hardcore");
  });

  it("ignores anything else", () => {
    expect(mortexAction("mortex://format-disk")).toBeUndefined();
    expect(mortexAction("mortex://profile")).toBeUndefined();
    expect(mortexAction("nxm://skyrimspecialedition/mods/1")).toBeUndefined();
    expect(mortexAction("not a url")).toBeUndefined();
  });
});
