/**
 * Placing a caret-anchored menu inside the viewport. Kept apart from the menu
 * component so the arithmetic can be tested without a DOM.
 */

/** Tallest the menu gets, and the gap between it and the caret. */
export const MENU_MAX_HEIGHT = 260;
export const MENU_WIDTH = 220;
const GAP = 4;
/** Room kept clear of the viewport edges. */
const EDGE = 8;

/**
 * Where the menu goes, in viewport coordinates.
 *
 * Below the caret when it fits, above it when the space below is smaller
 * than the space above - anchored by `bottom` then, so the menu grows upwards
 * from the line without having to know its own height first. Either way it is
 * capped to the room actually available, and pulled left if it would run off
 * the right edge.
 */
export interface Placement {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

export const placeAt = (
  caret: Pick<DOMRect, 'top' | 'bottom' | 'left'>,
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
): Placement => {
  const below = viewport.height - caret.bottom - GAP - EDGE;
  const above = caret.top - GAP - EDGE;
  const left = Math.max(
    EDGE,
    Math.min(caret.left, viewport.width - MENU_WIDTH - EDGE)
  );

  if (below >= MENU_MAX_HEIGHT || below >= above) {
    return {
      top: caret.bottom + GAP,
      left,
      maxHeight: Math.min(MENU_MAX_HEIGHT, below),
    };
  }

  return {
    bottom: viewport.height - caret.top + GAP,
    left,
    maxHeight: Math.min(MENU_MAX_HEIGHT, above),
  };
};
