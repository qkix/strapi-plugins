/**
 * Lazy, deduped loader for Pele, the Mermaid engine.
 *
 * `pele/lazy` fetches each diagram type's code the first time a diagram of
 * that type renders, so a page without diagrams loads none of it and a page
 * with a flowchart loads only the flowchart. The module itself is cached at
 * module scope: one import per page, however many diagrams that page holds.
 */

type PeleLazy = typeof import('pele/lazy');

let pelePromise: Promise<PeleLazy> | null = null;

export function loadPele(): Promise<PeleLazy> {
  if (!pelePromise) pelePromise = import('pele/lazy');
  return pelePromise;
}

// Pele gives SVG elements ids (an `accTitle` becomes an id'd <title>), under
// the same default prefix in every diagram, so each render gets its own.
let renderCount = 0;

export function nextIdPrefix(): string {
  return `bb-pele-${renderCount++}`;
}
