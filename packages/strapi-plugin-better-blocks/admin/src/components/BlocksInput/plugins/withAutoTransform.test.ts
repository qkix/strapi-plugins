import { createEditor, type Descendant, Editor, Node } from 'slate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The block modules pull in the admin's React and design-system tree, which
// this node-only suite cannot load. What matters here is whether the shortcut
// fires, so the converters are stand-ins that record being called.
vi.mock('../Blocks/Math', () => ({
  setBlockMath: vi.fn(),
  insertInlineMath: vi.fn(),
}));
vi.mock('../Blocks/Diagram', () => ({ setBlockDiagram: vi.fn() }));

import { insertInlineMath, setBlockMath } from '../Blocks/Math';
import { setBlockDiagram } from '../Blocks/Diagram';
import { withAutoTransform } from './withAutoTransform';

/**
 * An editor holding one paragraph with `text`, the caret at its end, as if
 * the author had just typed it, with the field's turned-off features set the
 * way `BlocksEditor` sets them.
 */
const typed = (text: string, disabledFeatures: string[] = []) => {
  const editor = withAutoTransform(createEditor()) as Editor & {
    pluginOptions?: Record<string, unknown>;
  };
  editor.pluginOptions = { disabledFeatures };
  editor.children = [
    { type: 'paragraph', children: [{ type: 'text', text }] },
  ] as unknown as Descendant[];
  const end = { path: [0, 0], offset: text.length };
  editor.selection = { anchor: end, focus: end };
  return editor;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('typed shortcuts respect turned-off features', () => {
  it('turns "$$" into a math block', () => {
    typed('$$').insertText(' ');
    expect(setBlockMath).toHaveBeenCalledOnce();
  });

  it('leaves "$$" as text when math is off', () => {
    const editor = typed('$$', ['math']);
    editor.insertText(' ');
    expect(setBlockMath).not.toHaveBeenCalled();
    expect(Node.string(editor)).toBe('$$ ');
  });

  it('turns "```mermaid" into a diagram, unless diagrams are off', () => {
    typed('```mermaid').insertText(' ');
    expect(setBlockDiagram).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    const editor = typed('```mermaid', ['diagram']);
    editor.insertText(' ');
    expect(setBlockDiagram).not.toHaveBeenCalled();
    expect(Node.string(editor)).toBe('```mermaid ');
  });

  it('leaves inline "$x$" as text when math is off', () => {
    const editor = typed('$x^2$', ['math']);
    editor.insertText(' ');
    expect(insertInlineMath).not.toHaveBeenCalled();
    expect(Node.string(editor)).toBe('$x^2$ ');
  });

  it('still does the typographic replacements, which are not a feature', () => {
    const editor = typed('a ->', ['math', 'diagram']);
    editor.insertText(' ');
    expect(Node.string(editor)).toBe('a → ');
  });
});
