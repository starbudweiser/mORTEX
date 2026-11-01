import { describe, expect, it } from "vitest";

import {
  COLS,
  cellAt,
  collides,
  compact,
  columnWidth,
  composeLayout,
  firstFit,
  GAP,
  layoutAll,
  resolveLayout,
  rowsFor,
  sanitize,
  sizeAt,
} from "./gridLayout";

describe("gridLayout", () => {
  it("compose les lignes sans trou, centre celle qui est incomplète", () => {
    expect(
      composeLayout([
        { id: "a", w: 6, h: 2 },
        { id: "b", w: 2, h: 3 },
        { id: "c", w: 2, h: 5 },
      ]),
    ).toEqual({
      a: { x: 0, y: 0, w: 6, h: 2 },
      b: { x: 1, y: 2, w: 2, h: 5 },
      c: { x: 3, y: 2, w: 2, h: 5 },
    });
  });

  it("passe à la ligne quand une carte ne tient plus", () => {
    const rects = composeLayout([
      { id: "a", w: 4, h: 2 },
      { id: "b", w: 4, h: 2 },
    ]);
    expect(rects.a).toEqual({ x: 1, y: 0, w: 4, h: 2 });
    expect(rects.b).toEqual({ x: 1, y: 2, w: 4, h: 2 });
  });

  it("ne compose rien sans carte", () => {
    expect(composeLayout([])).toEqual({});
  });

  it("arrondit une hauteur en pixels à la case supérieure", () => {
    expect(rowsFor(10)).toBe(2);
    expect(rowsFor(136)).toBe(2);
    expect(rowsFor(137)).toBe(3);
  });

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

  it("remonte les cartes pour boucher les trous, sans les chevaucher", () => {
    const result = compact({
      a: { x: 0, y: 0, w: 3, h: 2 },
      b: { x: 0, y: 6, w: 3, h: 2 },
      c: { x: 3, y: 5, w: 3, h: 2 },
      d: { x: 0, y: 9, w: 6, h: 2 },
    });
    expect(result.b.y).toBe(2);
    expect(result.c.y).toBe(0);
    expect(result.d.y).toBe(4);
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
