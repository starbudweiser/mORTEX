/**
 * mORTEX : place la bulle de la visite à côté de l'élément commenté, sa pointe tournée vers lui.
 * Barre latérale → à droite ; barre de titre → dessous ; sinon dessous, au-dessus faute de place.
 * Sans élément : au centre, sans pointe.
 */
export type BubbleSide = "right" | "left" | "bottom" | "top" | "center";

export interface IRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IBubblePlacement {
  left: number;
  top: number;
  side: BubbleSide;
  /** position de la pointe le long du bord, en px depuis le coin */
  arrow: number;
}

/** écart entre l'élément et la bulle, pointe comprise */
export const GAP = 16;
const MARGIN = 12;
const ARROW_INSET = 22;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function placeBubble(
  target: IRect | undefined,
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
): IBubblePlacement {
  if (target === undefined) {
    return {
      left: (viewport.width - bubble.width) / 2,
      top: (viewport.height - bubble.height) / 2,
      side: "center",
      arrow: 0,
    };
  }
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  const right = target.left + target.width;
  const bottom = target.top + target.height;

  let side: BubbleSide;
  if (target.left < viewport.width / 4 && right + GAP + bubble.width + MARGIN <= viewport.width) {
    side = "right";
  } else if (bottom + GAP + bubble.height + MARGIN <= viewport.height) {
    side = "bottom";
  } else if (target.top - GAP - bubble.height >= MARGIN) {
    side = "top";
  } else {
    side = "left";
  }

  if (side === "right" || side === "left") {
    const top = clamp(
      centerY - bubble.height / 2,
      MARGIN,
      viewport.height - bubble.height - MARGIN,
    );
    return {
      left: side === "right" ? right + GAP : target.left - GAP - bubble.width,
      top,
      side,
      arrow: clamp(centerY - top, ARROW_INSET, bubble.height - ARROW_INSET),
    };
  }
  const left = clamp(centerX - bubble.width / 2, MARGIN, viewport.width - bubble.width - MARGIN);
  return {
    left,
    top: side === "bottom" ? bottom + GAP : target.top - GAP - bubble.height,
    side,
    arrow: clamp(centerX - left, ARROW_INSET, bubble.width - ARROW_INSET),
  };
}
