import { describe, expect, it } from 'vitest';

import {
  FEATURES,
  fieldOptionName,
  isBlockEnabled,
  isMarkEnabled,
  isSlashCommandEnabled,
  resolveDisabledFeatures,
  restrictBlocks,
  restrictModifiers,
} from './features';

const set = (...ids: string[]) => new Set(ids);

describe('the catalogue', () => {
  it('has unique ids and option names', () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);

    const names = ids.map(fieldOptionName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('never lets a block or mark belong to two features', () => {
    // Two owners would make the outcome depend on which one `find` hits first.
    // Blocks and marks are separate namespaces - `code` is both the code
    // block and the inline-code mark - so each is checked on its own.
    const blocks = FEATURES.flatMap((feature) =>
      'blocks' in feature ? [...feature.blocks] : []
    );
    const marks = FEATURES.flatMap((feature) =>
      'marks' in feature ? [...feature.marks] : []
    );
    expect(new Set(blocks).size).toBe(blocks.length);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('cannot turn off the paragraph, which every document needs', () => {
    expect(isBlockEnabled('paragraph', set(...FEATURES.map((f) => f.id)))).toBe(
      true
    );
  });

  it('names field options the way the builder stores checkboxes', () => {
    expect(fieldOptionName('fontSize')).toBe('disableFontSize');
    expect(fieldOptionName('table')).toBe('disableTable');
  });
});

describe('resolving what a field has turned off', () => {
  it('is nothing by default', () => {
    expect(resolveDisabledFeatures(undefined, undefined)).toEqual([]);
    expect(resolveDisabledFeatures({}, [])).toEqual([]);
  });

  it('reads the field checkboxes', () => {
    expect(
      resolveDisabledFeatures(
        { disableFontSize: true, disableTable: true, disableEmoji: false },
        []
      ).sort()
    ).toEqual(['fontSize', 'table']);
  });

  it('adds the global list, which a field cannot undo', () => {
    // An unticked box is "not set", not "re-enable": the global list is a floor.
    expect(
      resolveDisabledFeatures({ disableFontSize: false, disableTable: true }, [
        'fontSize',
      ]).sort()
    ).toEqual(['fontSize', 'table']);
  });

  it('keeps unknown global ids, which is how a registered block is turned off', () => {
    expect(resolveDisabledFeatures({}, ['chart'])).toEqual(['chart']);
  });

  it('ignores junk in the global list rather than crashing the editor', () => {
    expect(resolveDisabledFeatures({}, 'fontSize')).toEqual([]);
    expect(resolveDisabledFeatures({}, [42, null, '', ' table '])).toEqual([
      'table',
    ]);
  });
});

describe('what each entry point consults', () => {
  it('maps blocks to their feature', () => {
    expect(isBlockEnabled('heading-three', set('headings'))).toBe(false);
    expect(isBlockEnabled('list-todo', set('lists'))).toBe(false);
    expect(isBlockEnabled('code', set('codeBlock'))).toBe(false);
    expect(isBlockEnabled('code', set('inlineCode'))).toBe(true);
  });

  it('answers to a registered block by its type', () => {
    expect(isBlockEnabled('chart', set('chart'))).toBe(false);
    expect(isBlockEnabled('chart', set('table'))).toBe(true);
  });

  it('maps marks to their feature, including the shared ones', () => {
    expect(isMarkEnabled('bold', set('bold'))).toBe(false);
    expect(isMarkEnabled('code', set('inlineCode'))).toBe(false);
    expect(isMarkEnabled('subscript', set('superscriptSubscript'))).toBe(false);
    expect(isMarkEnabled('italic', set('bold'))).toBe(true);
  });

  it('maps slash commands, prefixes included', () => {
    expect(isSlashCommandEnabled('heading-2', set('headings'))).toBe(false);
    expect(isSlashCommandEnabled('callout-warning', set('callout'))).toBe(
      false
    );
    expect(isSlashCommandEnabled('mermaid', set('diagram'))).toBe(false);
    expect(isSlashCommandEnabled('paragraph', set('headings'))).toBe(true);
    expect(isSlashCommandEnabled('chart', set('chart'))).toBe(false);
  });
});

describe('restricting the stores', () => {
  const renderElement = () => null;
  const blocks = {
    paragraph: {
      renderElement,
      isInBlocksSelector: true,
      handleConvert: () => {},
    },
    'heading-one': {
      renderElement,
      isInBlocksSelector: true,
      handleConvert: () => {},
      snippets: ['#'],
    },
  };

  it('returns the same store when nothing is off', () => {
    expect(restrictBlocks(blocks, set())).toBe(blocks);
  });

  it('takes a block out of menus and hotkeys but keeps it renderable', () => {
    const restricted = restrictBlocks(blocks, set('headings'));
    const heading = restricted['heading-one'] as Record<string, unknown>;

    // Still in the store: a heading already in the document must render.
    expect(heading.renderElement).toBe(renderElement);
    expect(heading.isInBlocksSelector).toBe(false);
    expect(heading.handleConvert).toBeUndefined();
    expect(heading.snippets).toBeUndefined();
    expect(restricted.paragraph).toBe(blocks.paragraph);
  });

  it('drops turned-off marks from the modifiers', () => {
    const modifiers = { bold: {}, italic: {}, code: {} };
    expect(
      Object.keys(restrictModifiers(modifiers, set('bold', 'inlineCode')))
    ).toEqual(['italic']);
  });
});
