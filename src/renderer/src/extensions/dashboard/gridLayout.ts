/**
 * Grille du tableau de bord : placement libre sur des cases, façon widgets macOS.
 *
 * Fonctions pures (sans React) : placement initial, résolution des collisions
 * (les cartes gênées sont repoussées vers le bas), bornes de taille.
 */

/** nombre de colonnes de la grille */
export const COLS = 6;
/** hauteur d'une case, en pixels */
export const ROW_HEIGHT = 60;
/** espace entre deux cases, en pixels */
export const GAP = 16;
/** taille minimale d'une carte, en cases */
export const MIN_W = 2;
export const MIN_H = 2;
/** un ancien « 1 » de largeur (tiers de la grille) vaut deux colonnes, un ancien « 1 » de hauteur deux lignes */
export const LEGACY_W = COLS / 3;
export const LEGACY_H = 2;

export interface IRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RectMap = { [id: string]: IRect };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function collides(lhs: IRect, rhs: IRect): boolean {
  return (
    lhs.x < rhs.x + rhs.w && rhs.x < lhs.x + lhs.w && lhs.y < rhs.y + rhs.h && rhs.y < lhs.y + lhs.h
  );
}

/** ramène un rectangle dans les bornes de la grille */
export function sanitize(rect: IRect): IRect {
  const w = clamp(Math.round(rect.w), MIN_W, COLS);
  const h = Math.max(MIN_H, Math.round(rect.h));
  return {
    x: clamp(Math.round(rect.x), 0, COLS - w),
    y: Math.max(0, Math.round(rect.y)),
    w,
    h,
  };
}

/** première place libre (de gauche à droite, de haut en bas) pour une carte w × h */
export function firstFit(placed: IRect[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; ; ++y) {
    for (let x = 0; x <= COLS - w; ++x) {
      const candidate = { x, y, w, h };
      if (!placed.some((other) => collides(candidate, other))) {
        return { x, y };
      }
    }
  }
}

/**
 * Pose les cartes dans l'ordre : celle qu'on déplace (`priorityId`) garde sa place, les autres
 * sont repoussées vers le bas tant qu'elles en gênent une déjà posée. Aucune n'est remontée :
 * une carte posée plus bas reste où on l'a mise.
 */
export function resolveLayout(rects: RectMap, priorityId?: string): RectMap {
  const ids = Object.keys(rects).sort((lhs, rhs) => {
    if (lhs === priorityId) return -1;
    if (rhs === priorityId) return 1;
    return rects[lhs].y - rects[rhs].y || rects[lhs].x - rects[rhs].x;
  });

  const result: RectMap = {};
  const placed: IRect[] = [];
  for (const id of ids) {
    const rect = { ...rects[id] };
    for (;;) {
      const blockers = placed.filter((other) => collides(rect, other));
      if (blockers.length === 0) {
        break;
      }
      rect.y = Math.max(...blockers.map((other) => other.y + other.h));
    }
    result[id] = rect;
    placed.push(rect);
  }
  return result;
}

export interface ILayoutEntry {
  id: string;
  /** taille d'origine, en cases, quand aucune position n'est enregistrée */
  defaultSize: { w: number; h: number };
}

/**
 * Place toutes les cartes visibles : celles qui ont une position enregistrée la gardent
 * (collisions résolues), les autres prennent la première place libre, dans l'ordre donné.
 */
export function layoutAll(entries: ILayoutEntry[], stored: RectMap): RectMap {
  const known: RectMap = {};
  for (const entry of entries) {
    const rect = stored[entry.id];
    if (rect !== undefined) {
      known[entry.id] = sanitize(rect);
    }
  }
  const result = resolveLayout(known);
  const placed = Object.values(result);
  for (const entry of entries) {
    if (result[entry.id] === undefined) {
      const { w, h } = entry.defaultSize;
      const rect = { ...firstFit(placed, w, h), w, h };
      result[entry.id] = rect;
      placed.push(rect);
    }
  }
  return result;
}

/** dimensions en pixels d'une colonne pour une largeur de conteneur donnée */
export function columnWidth(containerWidth: number): number {
  return Math.max(0, (containerWidth - GAP * (COLS - 1)) / COLS);
}

/** nombre de lignes occupées */
export function rowCount(rects: RectMap): number {
  return Object.values(rects).reduce((max, rect) => Math.max(max, rect.y + rect.h), 0);
}

export function toPixels(rect: IRect, colW: number): IRect {
  return {
    x: rect.x * (colW + GAP),
    y: rect.y * (ROW_HEIGHT + GAP),
    w: rect.w * colW + (rect.w - 1) * GAP,
    h: rect.h * ROW_HEIGHT + (rect.h - 1) * GAP,
  };
}

/** case la plus proche d'une position en pixels (déplacement) */
export function cellAt(rect: IRect, pxLeft: number, pxTop: number, colW: number): IRect {
  return sanitize({
    ...rect,
    x: pxLeft / (colW + GAP),
    y: pxTop / (ROW_HEIGHT + GAP),
  });
}

/** taille en cases la plus proche d'une taille en pixels (redimensionnement) */
export function sizeAt(rect: IRect, pxWidth: number, pxHeight: number, colW: number): IRect {
  const w = Math.round((pxWidth + GAP) / (colW + GAP));
  const h = Math.round((pxHeight + GAP) / (ROW_HEIGHT + GAP));
  return sanitize({ ...rect, w: Math.min(w, COLS - rect.x), h });
}
