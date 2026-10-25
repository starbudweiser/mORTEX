import { describe, expect, it } from "vitest";

import { isFinderJunk } from "./finderJunk";

describe("isFinderJunk", () => {
  it("reconnaît .DS_Store, où qu'il soit", () => {
    expect(isFinderJunk("/Data/Scripts/.DS_Store")).toBe(true);
  });

  it("ne prend pas un vrai fichier pour un déchet du Finder", () => {
    expect(isFinderJunk("/Data/Scripts/armor.pex")).toBe(false);
    expect(isFinderJunk("/Data/DS_Store.esp")).toBe(false);
  });
});
