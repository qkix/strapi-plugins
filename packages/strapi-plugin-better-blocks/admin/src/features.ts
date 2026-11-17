/**
 * Editor features a project can turn off, per field or for every field.
 *
 * One catalogue, read by every place an author can reach a feature from: the
 * toolbar, the floating selection toolbar, the slash menu, the block hotkeys
 * and the typed shortcuts (`$$`, ```` ```mermaid ````). Hiding a toolbar button
 * alone would not restrict anything - the same colour is one text selection
 * away in the floating toolbar, the same table one `/` away - so a feature is
 * either available everywhere or nowhere.
 *
 * Turning a feature off never touches content. A document that already has a
 * heading keeps it, renders it and can still be edited; the author just cannot
 * add another. Content pasted in from elsewhere is not filtered either.
 *
 * Kept free of React and Slate so it can be tested on its own.
 */

export type FeatureGroup = 'text' | 'paragraph' | 'insert';

export interface FeatureDefinition {
  id: string;
  label: string;
  group: FeatureGroup;
  /** Block-store keys this feature owns: hidden from menus, hotkeys disarmed. */
  blocks?: readonly string[];
  /** Modifier (mark) keys this feature owns. */
  marks?: readonly string[];
  /** Slash-menu command ids; a trailing `*` matches a prefix. */
  slash?: readonly string[];
}

export const FEATURES = [
  // ---- Text: the look of the characters ----
  {
    id: 'headings',
    label: 'Headings',
    group: 'text',
    blocks: [
      'heading-one',
      'heading-two',
      'heading-three',
      'heading-four',
      'heading-five',
      'heading-six',
    ],
    slash: ['heading-*'],
  },
  { id: 'fontSize', label: 'Font size', group: 'text' },
  { id: 'fontFamily', label: 'Font family', group: 'text' },
  { id: 'textColor', label: 'Text color', group: 'text' },
  { id: 'backgroundColor', label: 'Highlight color', group: 'text' },
  { id: 'bold', label: 'Bold', group: 'text', marks: ['bold'] },
  { id: 'italic', label: 'Italic', group: 'text', marks: ['italic'] },
  { id: 'underline', label: 'Underline', group: 'text', marks: ['underline'] },
  {
    id: 'strikethrough',
    label: 'Strikethrough',
    group: 'text',
    marks: ['strikethrough'],
  },
  { id: 'inlineCode', label: 'Inline code', group: 'text', marks: ['code'] },
  {
    id: 'superscriptSubscript',
    label: 'Superscript and subscript',
    group: 'text',
    marks: ['superscript', 'subscript'],
  },
  { id: 'uppercase', label: 'Uppercase', group: 'text', marks: ['uppercase'] },
  { id: 'link', label: 'Links', group: 'text' },

  // ---- Paragraph: the shape of a block ----
  {
    id: 'lists',
    label: 'Lists (bulleted, numbered, to-do)',
    group: 'paragraph',
    blocks: ['list-ordered', 'list-unordered', 'list-todo'],
    slash: ['bulleted-list', 'numbered-list', 'todo-list'],
  },
  {
    id: 'quote',
    label: 'Quote',
    group: 'paragraph',
    blocks: ['quote'],
    slash: ['quote'],
  },
  { id: 'alignment', label: 'Text alignment', group: 'paragraph' },
  { id: 'lineHeight', label: 'Line height', group: 'paragraph' },
  { id: 'indent', label: 'Indent and outdent', group: 'paragraph' },

  // ---- Insert: blocks that are not text ----
  {
    id: 'codeBlock',
    label: 'Code block',
    group: 'insert',
    blocks: ['code'],
    slash: ['code'],
  },
  { id: 'table', label: 'Table', group: 'insert', slash: ['table'] },
  { id: 'image', label: 'Image', group: 'insert', blocks: ['image'] },
  { id: 'audio', label: 'Audio', group: 'insert', blocks: ['audio'] },
  {
    id: 'video',
    label: 'Video',
    group: 'insert',
    blocks: ['video'],
    slash: ['video'],
  },
  {
    id: 'embed',
    label: 'Media embed (YouTube, Vimeo...)',
    group: 'insert',
    blocks: ['embed'],
    slash: ['embed'],
  },
  {
    id: 'socialEmbed',
    label: 'Social post embed',
    group: 'insert',
    blocks: ['social-embed'],
  },
  { id: 'button', label: 'Button', group: 'insert', blocks: ['button'] },
  {
    id: 'callout',
    label: 'Callout',
    group: 'insert',
    blocks: ['callout'],
    slash: ['callout-*'],
  },
  {
    id: 'details',
    label: 'Collapsible details',
    group: 'insert',
    blocks: ['details'],
    slash: ['details'],
  },
  {
    id: 'diagram',
    label: 'Diagram (Mermaid)',
    group: 'insert',
    blocks: ['diagram'],
    slash: ['mermaid'],
  },
  {
    id: 'math',
    label: 'Math (block and inline)',
    group: 'insert',
    blocks: ['math'],
    slash: ['math'],
  },
  {
    id: 'horizontalLine',
    label: 'Horizontal line',
    group: 'insert',
    slash: ['horizontal-line'],
  },
  { id: 'emoji', label: 'Emoji picker', group: 'insert' },
  { id: 'specialCharacters', label: 'Special characters', group: 'insert' },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof FEATURES)[number]['id'];

/** The same list, widened so optional fields can be read without casts. */
const CATALOGUE: readonly FeatureDefinition[] = FEATURES;

const BY_ID = new Map(CATALOGUE.map((feature) => [feature.id, feature]));

export const isFeatureId = (value: unknown): value is FeatureId =>
  typeof value === 'string' && BY_ID.has(value);

/**
 * The field option that turns a feature off in the content-type builder:
 * `fontSize` -> `disableFontSize`. Flat names, because that is what the
 * builder's checkbox inputs store, next to `disableDefaultColors`.
 */
export const fieldOptionName = (id: FeatureId): string =>
  `disable${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/**
 * Everything turned off for one field: the project-wide list from
 * `config/plugins` plus whatever the field itself ticks.
 *
 * A union, not an override. The global list is a floor every field shares - a
 * project that bans font sizes does not want one forgotten field to bring them
 * back - and a checkbox has no third state that could mean "re-enable".
 *
 * Unknown ids in the global list are kept rather than dropped: they are how a
 * block that another package registered (Chartkit's `chart`, say) is turned
 * off, and that block's type is not in this catalogue.
 */
export const resolveDisabledFeatures = (
  fieldOptions: Record<string, unknown> | undefined,
  globalDisabled: unknown
): string[] => {
  const disabled = new Set<string>();

  if (Array.isArray(globalDisabled)) {
    for (const id of globalDisabled) {
      if (typeof id === 'string' && id.trim()) disabled.add(id.trim());
    }
  }

  for (const feature of FEATURES) {
    if (fieldOptions?.[fieldOptionName(feature.id)] === true) {
      disabled.add(feature.id);
    }
  }

  return [...disabled];
};

/** The feature that owns a block-store key, or the key itself for registered blocks. */
const featureForBlock = (blockKey: string): string =>
  CATALOGUE.find((feature) => feature.blocks?.includes(blockKey))?.id ??
  blockKey;

export const isBlockEnabled = (
  blockKey: string,
  disabled: ReadonlySet<string>
): boolean => !disabled.has(featureForBlock(blockKey));

export const isMarkEnabled = (
  markKey: string,
  disabled: ReadonlySet<string>
): boolean =>
  !CATALOGUE.some(
    (feature) => feature.marks?.includes(markKey) && disabled.has(feature.id)
  );

const matchesSlashId = (pattern: string, id: string) =>
  pattern.endsWith('*') ? id.startsWith(pattern.slice(0, -1)) : pattern === id;

/**
 * Whether a slash command stays in the menu. Commands no feature claims are a
 * registered block's type, so they answer to that type in the disabled list.
 */
export const isSlashCommandEnabled = (
  commandId: string,
  disabled: ReadonlySet<string>
): boolean => {
  const owner = CATALOGUE.find((feature) =>
    feature.slash?.some((pattern) => matchesSlashId(pattern, commandId))
  );
  return !disabled.has(owner?.id ?? commandId);
};

/**
 * The block store with disabled blocks taken out of every menu and hotkey -
 * but not out of the store. Existing content still has to find its
 * `renderElement`, `matchNode` and key handlers, or a heading already in the
 * document would render as nothing the moment headings were turned off.
 */
export const restrictBlocks = <T extends Record<string, object>>(
  blocks: T,
  disabled: ReadonlySet<string>
): T => {
  if (disabled.size === 0) return blocks;

  return Object.fromEntries(
    Object.entries(blocks).map(([key, block]) => {
      if (isBlockEnabled(key, disabled)) return [key, block];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { handleConvert, snippets, ...rest } = block as {
        handleConvert?: unknown;
        snippets?: unknown;
      };
      return [key, { ...rest, isInBlocksSelector: false }];
    })
  ) as T;
};

/** The modifiers store without the marks that are turned off. */
export const restrictModifiers = <T extends object>(
  modifiers: T,
  disabled: ReadonlySet<string>
): T => {
  if (disabled.size === 0) return modifiers;

  return Object.fromEntries(
    Object.entries(modifiers).filter(([key]) => isMarkEnabled(key, disabled))
  ) as T;
};

/**
 * Section titles in the field's Advanced settings. A ticked box turns the
 * feature off - the titles say so, since the builder has no room for a hint
 * under each of the thirty-odd checkboxes.
 */
export const FEATURE_GROUP_TITLES: Record<FeatureGroup, string> = {
  text: 'Turn off in this field: text formatting',
  paragraph: 'Turn off in this field: paragraph formatting',
  insert: 'Turn off in this field: inserted blocks',
};
