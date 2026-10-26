import {
  createEditor,
  Editor,
  Element,
  type Descendant,
  type Path,
} from 'slate';
import { describe, expect, it } from 'vitest';

import { insertLink } from '../utils/links';
import type { CustomElement } from '../utils/types';
import { withLinks } from './withLinks';

const paragraph = (text: string): CustomElement =>
  ({
    type: 'paragraph',
    children: [{ type: 'text', text }],
  }) as unknown as CustomElement;

const linkPaths = (editor: Editor): Path[] =>
  Array.from(
    Editor.nodes(editor, {
      at: [],
      match: (node) =>
        Element.isElement(node) && 'type' in node && node.type === 'link',
    })
  ).map(([, path]) => path);

const wrapInLink = (text: string, anchor: number, focus: number) => {
  const editor = withLinks(createEditor()) as ReturnType<typeof withLinks> &
    Editor;
  editor.children = [paragraph(text)] as Descendant[];
  editor.selection = {
    anchor: { path: [0, 0], offset: anchor },
    focus: { path: [0, 0], offset: focus },
  };
  insertLink(editor, { url: '' });
  return editor;
};

describe('withLinks', () => {
  // The link popover opens only when its path equals lastInsertedLinkPath.
  it.each([
    ['at the start of the paragraph', 0, 4],
    ['in the middle of the paragraph', 5, 9],
    ['at the end of the paragraph', 10, 14],
    ['covering the whole paragraph', 0, 14],
  ])('records the final path of a link wrapped %s', (_, anchor, focus) => {
    const editor = wrapInLink('open this page', anchor, focus);

    expect(linkPaths(editor)).toHaveLength(1);
    expect(editor.lastInsertedLinkPath).toEqual(linkPaths(editor)[0]);
  });
});
