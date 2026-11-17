import { describe, expect, it } from 'vitest';

import { MENU_MAX_HEIGHT, MENU_WIDTH, placeAt } from './menuPlacement';

const viewport = { width: 1280, height: 800 };
const caretAt = (top: number, left = 300, height = 20) => ({
  top,
  bottom: top + height,
  left,
});

describe('placing the slash menu', () => {
  it('opens below the caret when there is room', () => {
    const placement = placeAt(caretAt(100), viewport);
    expect(placement.top).toBe(124);
    expect(placement.bottom).toBeUndefined();
    expect(placement.maxHeight).toBe(MENU_MAX_HEIGHT);
  });

  it('opens above a caret near the bottom of the viewport', () => {
    // The case from #203: the last line of a short document, low on screen.
    const placement = placeAt(caretAt(720), viewport);
    expect(placement.top).toBeUndefined();
    expect(placement.bottom).toBe(800 - 720 + 4);
    expect(placement.maxHeight).toBe(MENU_MAX_HEIGHT);
  });

  it('caps the height to the room there is, on whichever side is bigger', () => {
    const tiny = { width: 1280, height: 300 };
    const placement = placeAt(caretAt(140), tiny);
    // 128 px either way: a tie stays below, shortened to fit.
    expect(placement.top).toBe(164);
    expect(placement.maxHeight).toBe(300 - 160 - 4 - 8);
  });

  it('pulls left instead of running off the right edge', () => {
    const placement = placeAt(caretAt(100, 1250), viewport);
    expect(placement.left).toBe(1280 - MENU_WIDTH - 8);
  });

  it('never goes past the left edge', () => {
    expect(placeAt(caretAt(100, -50), viewport).left).toBe(8);
  });
});
