import { describe, expect, it } from "vitest";

import { brandRanges } from "./brandHighlight";

describe("brand highlight", () => {
  it("covers the m of every mORTEX, and nothing else", () => {
    document.body.innerHTML =
      "<p>mORTEX prend un instantané</p><span>Afficher mORTEX · Quitter mORTEX</span><i>MORTEX mortex</i>";
    const ranges = brandRanges(document.body);
    expect(ranges.map((range) => [range.toString(), range.startOffset])).toEqual([
      ["m", 0],
      ["m", 9],
      ["m", 26],
    ]);
  });
});
