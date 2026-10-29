import { describe, expect, it } from "vitest";

import { collectionRanges, matchOffsets } from "./collectionHighlight";

describe("collection highlight", () => {
  it("finds a name cut by zero-width spaces", () => {
    const text = "Collection incomplète : I&\u200bA and I&\u200bA+\u200b and NSFW.";
    const [[start, end]] = matchOffsets(text, "I&A and I&A+ and NSFW");
    expect(text.slice(start, end).replace(/\u200b/g, "")).toBe("I&A and I&A+ and NSFW");
  });

  it("finds every occurrence", () => {
    expect(matchOffsets("Gate et Gate", "Gate")).toEqual([
      [0, 4],
      [8, 12],
    ]);
  });

  it("underlines on coloured backgrounds, colours elsewhere", () => {
    document.body.innerHTML =
      '<p>Retirer « Truly Essentials » ?</p><div class="notification"><span>Truly Essentials incomplète</span></div><i>Tr</i>';
    const { plain, onColor } = collectionRanges(document.body, ["Truly Essentials", "Tr"]);
    expect(plain.map((range) => range.toString())).toEqual(["Truly Essentials"]);
    expect(onColor.map((range) => range.toString())).toEqual(["Truly Essentials"]);
  });
});
