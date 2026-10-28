// Deprecation notices are printed once per process: a site build renders the
// same component hundreds of times, and one line says all there is to say.
const warned = new Set<string>();

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[@qkix/better-blocks-astro-renderer] ${message}`);
}

/** For tests: forget which notices were printed. Not exported from the package. */
export function resetWarnings(): void {
  warned.clear();
}
