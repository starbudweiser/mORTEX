import type * as lootT from "loot";
import { describe, expect, it } from "vitest";

// mORTEX : libloot.0.dylib et node-loot.node sont compilés par mac/loot_native.sh.
describe.skipIf(process.platform !== "darwin")("libloot arm64 (node-loot)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loot = require("loot") as typeof lootT;

  it("charge l'addon et sa dylib", () => {
    expect(typeof loot.LootAsync).toBe("function");
  });

  it("annonce la version 0.29 de libloot", () => {
    expect(loot.IsCompatible(0, 29, 6)).toBe(true);
    expect(loot.IsCompatible(0, 1, 0)).toBe(false);
  });
});
