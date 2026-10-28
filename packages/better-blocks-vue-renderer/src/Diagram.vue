<script setup lang="ts">
/**
 * A Mermaid diagram, rendered to inline SVG by Pele on the client - the same
 * engine the Astro renderer runs on the server and the editor previews with,
 * so a diagram looks the same everywhere.
 *
 * The server and the first client render both emit the raw source in a
 * `<pre>` - so hydration matches - and the SVG is swapped in after mount. Pele
 * could render during SSR, but only through its synchronous build, which
 * carries every diagram type; loading it lazily on the client keeps it off
 * pages without diagrams and loads only the types a page uses.
 *
 * If Pele fails to parse the diagram the raw source simply stays put, so
 * content is never lost.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { resolveDiagramPalette, toPeleWrapperStyle } from '@qkix/better-blocks-core';

import type { CustomBlocksConfig, DiagramNode, DiagramTheme } from './types';

import { loadPele, nextIdPrefix } from './pele';
import { rawComponent } from './utils';

const props = defineProps<{
  node: DiagramNode;
  blocks?: CustomBlocksConfig;
  diagramTheme?: DiagramTheme;
}>();

const DiagramComp = computed(() => rawComponent(props.blocks?.diagram));
const source = computed(() => props.node.value ?? '');
const format = computed(() => props.node.format ?? 'mermaid');

// Pele colors its SVG through `--pele-*` custom properties, so the theme is a
// style on the wrapper: changing it restyles the diagram without re-rendering.
// A `%%{init}%%` directive in the source wins, as it did under mermaid.js;
// then `diagramTheme`; then the shared default (mermaid.js's lavender look).
const wrapperStyle = computed(() =>
  toPeleWrapperStyle(resolveDiagramPalette(source.value, props.diagramTheme))
);

const svg = ref<string | null>(null);

// Bumped on every (re-)render and on unmount, so a render that resolves after
// the source changed - or after the component is gone - drops its result.
let generation = 0;

async function renderDiagram() {
  const token = ++generation;
  svg.value = null;

  if (DiagramComp.value || !source.value) return;

  try {
    const { renderAsync } = await loadPele();
    const { svg: rendered } = await renderAsync(source.value, { idPrefix: nextIdPrefix() });
    if (token === generation) svg.value = rendered;
  } catch {
    // Leave the raw-source fallback in place on parse/render errors.
  }
}

onMounted(renderDiagram);
watch(source, renderDiagram);
onBeforeUnmount(() => {
  generation++;
});
</script>

<template>
  <component :is="DiagramComp" v-if="DiagramComp" :code="source" :format="format" />
  <div v-else-if="svg" class="mermaid-diagram" :style="wrapperStyle" v-html="svg"></div>
  <pre v-else class="mermaid-source">{{ source }}</pre>
</template>
