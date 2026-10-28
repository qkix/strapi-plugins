import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DIAGRAM_COLORS,
  DIAGRAM_THEMES,
  MERMAID_THEME_COLORS,
  diagramColorsFromSource,
  resolveDiagramPalette,
  applyDiagramTheme,
  resolveDiagramColors,
  toMermaidThemeVariables,
  toPeleThemeVariables,
  toPeleWrapperStyle,
  toPeleWrapperStyleObject,
} from '../src/diagram';

const SOURCE = 'graph TD\n  A[Start] --> B[End]';

/** The `%%{init: …}%%` payload a themed source carries, parsed back out. */
function initDirective(source: string): Record<string, any> | null {
  const match = source.match(/^%%\{init: (.+?)\}%%\n/);
  return match ? JSON.parse(match[1]) : null;
}

describe('resolveDiagramColors', () => {
  it('returns null when no theme is given', () => {
    expect(resolveDiagramColors(undefined)).toBeNull();
    expect(resolveDiagramColors(null)).toBeNull();
  });

  it('looks up a built-in palette by name', () => {
    expect(resolveDiagramColors('dracula')).toEqual(DIAGRAM_THEMES.dracula);
  });

  it('passes a custom color object through untouched', () => {
    const colors = { bg: '#ffffff', fg: '#222222' };
    expect(resolveDiagramColors(colors)).toBe(colors);
  });

  it('returns null for an unknown theme name rather than guessing', () => {
    expect(resolveDiagramColors('not-a-theme')).toBeNull();
  });
});

describe('toMermaidThemeVariables', () => {
  it('emits only the variables a palette actually sets', () => {
    expect(toMermaidThemeVariables({ bg: '#ffffff', fg: '#222222' })).toEqual({
      background: '#ffffff',
      primaryColor: '#ffffff',
      primaryTextColor: '#222222',
      textColor: '#222222',
    });
  });

  it('prefers surface/border over the base pair for node fill and stroke', () => {
    const vars = toMermaidThemeVariables({
      bg: '#ffffff',
      fg: '#333333',
      surface: '#ececff',
      border: '#9370db',
      accent: '#ff0000',
    });
    expect(vars.primaryColor).toBe('#ececff');
    expect(vars.primaryBorderColor).toBe('#9370db');
  });

  it('falls back to the accent for lines and borders when they are omitted', () => {
    const vars = toMermaidThemeVariables({ fg: '#333333', accent: '#bd93f9' });
    expect(vars.lineColor).toBe('#bd93f9');
    expect(vars.primaryBorderColor).toBe('#bd93f9');
  });

  it('lets `transparent` win over `bg`', () => {
    const vars = toMermaidThemeVariables({ bg: '#ffffff', fg: '#000000', transparent: true });
    expect(vars.background).toBe('transparent');
  });
});

describe('applyDiagramTheme', () => {
  it('returns the source untouched when there is no theme', () => {
    expect(applyDiagramTheme(SOURCE)).toBe(SOURCE);
  });

  it('returns the source untouched for an unknown theme name', () => {
    expect(applyDiagramTheme(SOURCE, 'not-a-theme')).toBe(SOURCE);
  });

  it('prepends an init directive carrying the named palette', () => {
    const out = applyDiagramTheme(SOURCE, 'dracula');
    expect(out.endsWith(SOURCE)).toBe(true);

    const init = initDirective(out);
    expect(init?.theme).toBe('base');
    expect(init?.themeVariables.background).toBe('#282a36');
    expect(init?.themeVariables.lineColor).toBe('#6272a4');
  });

  it('prepends an init directive carrying a custom palette', () => {
    const init = initDirective(applyDiagramTheme(SOURCE, { bg: '#ffffff', accent: '#ff0000' }));
    expect(init?.themeVariables.secondaryColor).toBe('#ff0000');
    expect(init?.themeVariables.background).toBe('#ffffff');
  });

  it("keeps the author's own directive rather than stacking a second one", () => {
    const authored = `%%{init: {"theme":"forest"}}%%\n${SOURCE}`;
    expect(applyDiagramTheme(authored, 'dracula')).toBe(authored);
  });

  it('returns the source untouched for a palette that sets nothing', () => {
    expect(applyDiagramTheme(SOURCE, {})).toBe(SOURCE);
  });

  it('produces a directive mermaid can parse back', () => {
    for (const name of Object.keys(DIAGRAM_THEMES)) {
      const init = initDirective(applyDiagramTheme(SOURCE, name));
      expect(init, `theme ${name}`).not.toBeNull();
      expect(Object.keys(init!.themeVariables).length, `theme ${name}`).toBeGreaterThan(0);
    }
  });
});

describe('toPeleThemeVariables', () => {
  it('passes the colors a palette sets straight through', () => {
    const vars = toPeleThemeVariables({
      bg: '#ffffff',
      fg: '#333333',
      line: '#444444',
      accent: '#9370db',
      muted: '#666666',
      surface: '#ececff',
      border: '#9370db',
      font: 'Inter',
    });
    expect(vars).toMatchObject({
      '--pele-bg': '#ffffff',
      '--pele-fg': '#333333',
      '--pele-line': '#444444',
      '--pele-accent': '#9370db',
      '--pele-muted': '#666666',
      '--pele-surface': '#ececff',
      '--pele-border': '#9370db',
      '--pele-font': 'Inter',
    });
  });

  it('mixes node fills from bg/fg when a palette only sets those', () => {
    // Pele derives nothing itself: without these a dark bg/fg-only palette
    // leaves nodes on its light default fill, with light text on top.
    const vars = toPeleThemeVariables(DIAGRAM_THEMES['zinc-dark']);
    expect(vars['--pele-surface']).toBe('color-mix(in srgb, #FAFAFA 6%, #18181B)');
    expect(vars['--pele-surface-alt']).toBe('color-mix(in srgb, #FAFAFA 12%, #18181B)');
    expect(vars['--pele-border']).toBe('color-mix(in srgb, #FAFAFA 45%, #18181B)');
    expect(vars['--pele-muted']).toBe('color-mix(in srgb, #FAFAFA 60%, #18181B)');
    expect(vars['--pele-line']).toBe('#FAFAFA');
  });

  it('falls back to the accent for lines and borders, like the mermaid mapping', () => {
    const vars = toPeleThemeVariables({ bg: '#fff', fg: '#222', accent: '#ff0000' });
    expect(vars['--pele-line']).toBe('#ff0000');
    expect(vars['--pele-border']).toBe('#ff0000');
  });

  it('makes the background transparent when asked, over bg', () => {
    const vars = toPeleThemeVariables({ bg: '#000000', fg: '#ffffff', transparent: true });
    expect(vars['--pele-bg']).toBe('transparent');
    // bg still seeds the mixed fills.
    expect(vars['--pele-surface']).toContain('#000000');
  });

  it('emits nothing it cannot derive', () => {
    expect(toPeleThemeVariables({})).toEqual({});
    expect(toPeleThemeVariables({ fg: '#222' })).toEqual({
      '--pele-fg': '#222',
      '--pele-line': '#222',
    });
  });
});

describe('toPeleWrapperStyle', () => {
  it('carries the palette vars and paints a background sized to the diagram', () => {
    const style = toPeleWrapperStyle({ bg: '#000000', fg: '#ffffff' });
    expect(style).toContain('--pele-bg:#000000');
    expect(style).toContain('background:var(--pele-bg)');
    expect(style).toContain('width:fit-content');
    expect(style).toContain('max-width:100%');
  });

  it('paints no background when the palette has none', () => {
    expect(toPeleWrapperStyle({ fg: '#222222' })).toBe('--pele-fg:#222222;--pele-line:#222222');
  });
});

describe('diagramColorsFromSource', () => {
  it('returns null when the source sets no colors', () => {
    expect(diagramColorsFromSource(SOURCE)).toBeNull();
    expect(
      diagramColorsFromSource('%%{init: {"flowchart": {"curve": "basis"}}}%%\n' + SOURCE)
    ).toBeNull();
  });

  it("maps a named mermaid theme onto that theme's palette", () => {
    expect(diagramColorsFromSource('%%{init: {"theme": "dark"}}%%\n' + SOURCE)).toEqual(
      MERMAID_THEME_COLORS.dark
    );
    expect(diagramColorsFromSource('%%{init: {"theme": "forest"}}%%\n' + SOURCE)).toEqual(
      MERMAID_THEME_COLORS.forest
    );
  });

  it('accepts the loose syntax mermaid accepts', () => {
    // Single quotes, unquoted keys, trailing commas, the `initialize` alias.
    expect(diagramColorsFromSource("%%{init: { 'theme': 'neutral', }}%%\n" + SOURCE)).toEqual(
      MERMAID_THEME_COLORS.neutral
    );
    expect(diagramColorsFromSource('%%{initialize: { theme: "dark" }}%%\n' + SOURCE)).toEqual(
      MERMAID_THEME_COLORS.dark
    );
  });

  it('applies themeVariables on top of the named theme', () => {
    const colors = diagramColorsFromSource(
      '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ff0000", "lineColor": "#00ff00", "primaryTextColor": "#0000ff", "fontFamily": "Inter"}}}%%\n' +
        SOURCE
    );
    expect(colors).toMatchObject({
      bg: MERMAID_THEME_COLORS.base.bg,
      surface: '#ff0000',
      line: '#00ff00',
      fg: '#0000ff',
      font: 'Inter',
    });
  });

  it('reads back the directive applyDiagramTheme writes', () => {
    // Content saved while the renderers still themed through directives must
    // come out in the same colors.
    const themed = applyDiagramTheme(SOURCE, 'dracula');
    const colors = diagramColorsFromSource(themed);
    expect(colors?.bg).toBe(DIAGRAM_THEMES.dracula.bg);
    expect(colors?.fg).toBe(DIAGRAM_THEMES.dracula.fg);
    expect(colors?.border).toBe(DIAGRAM_THEMES.dracula.accent);
  });

  it('reads a theme named in frontmatter config', () => {
    expect(diagramColorsFromSource('---\nconfig:\n  theme: forest\n---\n' + SOURCE)).toEqual(
      MERMAID_THEME_COLORS.forest
    );
  });

  it('ignores an unknown theme name with no variables', () => {
    expect(diagramColorsFromSource('%%{init: {"theme": "midnight"}}%%\n' + SOURCE)).toBeNull();
  });

  it('ignores a directive it cannot parse', () => {
    expect(diagramColorsFromSource('%%{init: {theme: }}%%\n' + SOURCE)).toBeNull();
  });
});

describe('resolveDiagramPalette', () => {
  it("prefers the source's own directive over diagramTheme", () => {
    expect(resolveDiagramPalette('%%{init: {"theme": "dark"}}%%\n' + SOURCE, 'dracula')).toEqual(
      MERMAID_THEME_COLORS.dark
    );
  });

  it('falls back to diagramTheme, then the default', () => {
    expect(resolveDiagramPalette(SOURCE, 'dracula')).toEqual(DIAGRAM_THEMES.dracula);
    expect(resolveDiagramPalette(SOURCE, undefined)).toEqual(DEFAULT_DIAGRAM_COLORS);
  });
});

describe('toPeleWrapperStyleObject', () => {
  it('camelCases property names and keeps custom properties as they are', () => {
    expect(toPeleWrapperStyleObject({ bg: '#000000', fg: '#ffffff' })).toMatchObject({
      '--pele-bg': '#000000',
      background: 'var(--pele-bg)',
      width: 'fit-content',
      maxWidth: '100%',
    });
  });

  it('keeps a value that itself contains a colon', () => {
    expect(toPeleWrapperStyleObject({ fg: '#222', font: 'a:b' })['--pele-font']).toBe('a:b');
  });
});
