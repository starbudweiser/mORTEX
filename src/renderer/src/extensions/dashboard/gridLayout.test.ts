import { describe, expect, it } from "vitest";

import {
  COLS,
  cellAt,
  collides,
  columnWidth,
  firstFit,
  GAP,
  layoutAll,
  resolveLayout,
  sanitize,
  sizeAt,
} from "./gridLayout";

describe("gridLayout", () => {
  it("détecte les collisions", () => {
    expect(collides({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(collides({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(collides({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
  });

  it("ramène un rectangle dans la grille", () => {
    expect(sanitize({ x: 9, y: -3, w: 10, h: 0 })).toEqual({ x: 0, y: 0, w: COLS, h: 2 });
    expect(sanitize({ x: 5, y: 1, w: 2, h: 3 })).toEqual({ x: 4, y: 1, w: 2, h: 3 });
  });

  it("trouve la première place libre", () => {
    const placed = [{ x: 0, y: 0, w: 4, h: 2 }];
    expect(firstFit(placed, 2, 2)).toEqual({ x: 4, y: 0 });
    expect(firstFit(placed, 3, 2)).toEqual({ x: 0, y: 2 });
  });

  it("repousse vers le bas les cartes gênées, la carte déplacée garde sa place", () => {
    const result = resolveLayout(
      {
        a: { x: 0, y: 0, w: 3, h: 2 },
        b: { x: 0, y: 0, w: 3, h: 2 },
      },
      "b",
    );
    expect(result.b).toEqual({ x: 0, y: 0, w: 3, h: 2 });
    expect(result.a).toEqual({ x: 0, y: 2, w: 3, h: 2 });
  });

  it("ne remonte pas une carte posée plus bas", () => {
    const result = resolveLayout({ a: { x: 0, y: 6, w: 2, h: 2 } });
    expect(result.a.y).toBe(6);
  });

  it("place les cartes sans position à la suite, sans toucher aux autres", () => {
    const result = layoutAll(
      [
        { id: "a", defaultSize: { w: 2, h: 2 } },
        { id: "b", defaultSize: { w: 4, h: 2 } },
        { id: "c", defaultSize: { w: 2, h: 2 } },
      ],
      { c: { x: 4, y: 0, w: 2, h: 2 } },
    );
    expect(result.c).toEqual({ x: 4, y: 0, w: 2, h: 2 });
    expect(result.a).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(result.b).toEqual({ x: 0, y: 2, w: 4, h: 2 });
  });

  it("convertit des pixels en cases", () => {
    const colW = columnWidth(600 + 0);
    const rect = { x: 0, y: 0, w: 2, h: 2 };
    expect(cellAt(rect, colW + GAP, 0, colW).x).toBe(1);
    expect(cellAt(rect, 10 * (colW + GAP), 0, colW).x).toBe(COLS - 2);
    expect(sizeAt(rect, 3 * colW + 2 * GAP, 100, colW).w).toBe(3);
    expect(sizeAt(rect, 1, 1, colW)).toMatchObject({ w: 2, h: 2 });
  });
});
