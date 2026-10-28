'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import {
  DEFAULT_DIAGRAM_COLORS,
  resolveDiagramColors,
  toPeleWrapperStyle,
  type DiagramTheme,
} from '@qkix/better-blocks-core';

// Pele is the Mermaid engine the Astro renderer runs on the server and the
// editor previews with, so a diagram looks the same everywhere. It could render
// during SSR, but only through its synchronous build, which carries every
// diagram type; `pele/lazy` instead fetches each type's code the first time a
// diagram of that type renders, so pages without diagrams load none of it. The
// module is imported once and cached.
let pelePromise: Promise<typeof import('pele/lazy')> | null = null;

function loadPele() {
  if (!pelePromise) pelePromise = import('pele/lazy');
  return pelePromise;
}

// Pele gives SVG elements ids (an `accTitle` becomes an id'd <title>), under
// the same default prefix in every diagram, so each render gets its own.
let renderCount = 0;

// The shared wrapper style is CSS text; React wants an object with camelCased
// names (custom properties keep theirs).
function toReactStyle(cssText: string): CSSProperties {
  return cssText.split(';').reduce<Record<string, string>>((style, declaration) => {
    const at = declaration.indexOf(':');
    const name = declaration.slice(0, at);
    const key = name.startsWith('--')
      ? name
      : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = declaration.slice(at + 1);
    return style;
  }, {}) as CSSProperties;
}

/**
 * Renders a Mermaid diagram to inline SVG on the client.
 *
 * SSR / static export and the first client render both emit the raw Mermaid
 * source inside a `<pre>` (so hydration matches), then swap in the SVG after
 * mount. If Pele fails to parse the diagram, the raw source remains as a
 * graceful fallback instead of crashing the page.
 */
export function MermaidDiagram({
  value,
  theme,
}: {
  value: string;
  theme?: DiagramTheme;
}): ReactNode {
  const [svg, setSvg] = useState<string | null>(null);

  // Pele colors its SVG through `--pele-*` custom properties, so the theme is a
  // style on the wrapper: changing it restyles the diagram without rendering
  // it again. Without a theme, the shared default (mermaid.js's lavender look).
  // Keyed on the theme's content, since an inline object is a new reference on
  // every parent render.
  const themeKey = typeof theme === 'object' ? JSON.stringify(theme) : (theme ?? '');
  const wrapperStyle = useMemo(
    () => toReactStyle(toPeleWrapperStyle(resolveDiagramColors(theme) ?? DEFAULT_DIAGRAM_COLORS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeKey]
  );

  useEffect(() => {
    let canceled = false;
    setSvg(null);

    if (!value) return;

    loadPele()
      .then(({ renderAsync }) => renderAsync(value, { idPrefix: `bb-pele-${renderCount++}` }))
      .then(({ svg }) => {
        if (!canceled) setSvg(svg);
      })
      .catch(() => {
        // Leave the raw-source fallback in place on parse/render errors.
        if (!canceled) setSvg(null);
      });

    return () => {
      canceled = true;
    };
  }, [value]);

  if (svg) {
    return (
      <div
        className="mermaid-diagram"
        style={wrapperStyle}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return <pre className="mermaid-source">{value}</pre>;
}
