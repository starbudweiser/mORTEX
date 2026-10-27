import { describe, expect, it } from "vitest";

import { GAP, placeBubble } from "./placement";

const viewport = { width: 1440, height: 980 };
const bubble = { width: 360, height: 180 };

describe("tour bubble placement", () => {
  it("sits right of a sidebar entry, its tip on the entry's middle", () => {
    const placed = placeBubble({ left: 12, top: 300, width: 196, height: 40 }, bubble, viewport);
    expect(placed).toMatchObject({ side: "right", left: 208 + GAP });
    expect(placed.top + placed.arrow).toBe(320);
  });

  it("sits under a title bar button, its tip on the button, kept inside the window", () => {
    const placed = placeBubble({ left: 1316, top: 8, width: 108, height: 28 }, bubble, viewport);
    expect(placed).toMatchObject({ side: "bottom", top: 36 + GAP, left: 1440 - 360 - 12 });
    expect(placed.left + placed.arrow).toBeLessThanOrEqual(1440 - 12);
  });

  it("goes above an element near the bottom, and centres without one", () => {
    expect(
      placeBubble({ left: 600, top: 900, width: 100, height: 30 }, bubble, viewport).side,
    ).toBe("top");
    expect(placeBubble(undefined, bubble, viewport)).toEqual({
      left: 540,
      top: 400,
      side: "center",
      arrow: 0,
    });
  });
});
