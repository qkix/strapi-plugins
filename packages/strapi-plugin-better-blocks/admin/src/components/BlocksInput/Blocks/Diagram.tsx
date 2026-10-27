import * as React from 'react';

import {
  DEFAULT_DIAGRAM_COLORS,
  type DiagramColors,
  toPeleThemeVariables,
} from '@qkix/better-blocks-core';
import { Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Path, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled, useTheme } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type DiagramElement,
  isDiagramNode,
} from '../utils/types';

import { SourceEditorModal } from './SourceEditorModal';

/* ---------------------------------------------------------------------------
 * Icon (no diagram glyph ships with @strapi/icons, so we provide our own).
 * Resolves theme color names (e.g. "neutral600") like the built-in icons do.
 * -------------------------------------------------------------------------*/

interface DiagramIconProps extends React.SVGProps<SVGSVGElement> {
  fill?: string;
}

const DiagramIcon = ({ fill = 'currentColor', ...rest }: DiagramIconProps) => {
  const theme = useTheme();
  const colors = theme?.colors as unknown as Record<string, string> | undefined;
  const resolved = colors && fill in colors ? colors[fill] : fill;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke={resolved}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="8.5" y="2.5" width="7" height="5" rx="1" />
      <rect x="2.5" y="16.5" width="7" height="5" rx="1" />
      <rect x="14.5" y="16.5" width="7" height="5" rx="1" />
      <path d="M12 7.5v4" />
      <path d="M6 16.5v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
};

/* ---------------------------------------------------------------------------
 * Mermaid renderer. Pele, the engine the server-side renderers use, so the
 * preview matches the published page. `pele/lazy` fetches each diagram type's
 * code on first use, which keeps the admin bundle small. It is pure
 * TypeScript: the admin's CSP has no `unsafe-eval`, so a WASM engine would not
 * load here.
 * -------------------------------------------------------------------------*/

// Monotonic counter for unique SVG id prefixes. An `accTitle` becomes an id'd
// <title>, and the block and its modal preview can be on screen together.
let diagramRenderSeq = 0;

// Rough luminance check on the editor background so the diagram theme matches
// Strapi's light/dark mode without needing a configuration option.
const isDarkBackground = (color: string | undefined): boolean => {
  if (!color) return false;
  const hex = color.trim().replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance (perceptual weights); < 0.5 -> dark surface.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

const MermaidContent = ({
  value,
  isDark,
}: {
  value: string;
  isDark: boolean;
}) => {
  const { formatMessage } = useIntl();
  const theme = useTheme();
  const [rendered, setRendered] = React.useState<{
    svg: string;
    width: number;
  } | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let canceled = false;

    if (value.trim() === '') {
      setRendered(null);
      setError(false);
      return undefined;
    }

    (async () => {
      try {
        const { renderAsync } = await import('pele/lazy');
        diagramRenderSeq += 1;
        const { svg, width } = await renderAsync(value, {
          idPrefix: `bb-pele-${diagramRenderSeq}`,
        });
        if (!canceled) {
          setRendered({ svg, width });
          setError(false);
        }
      } catch {
        if (!canceled) {
          setRendered(null);
          setError(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [value]);

  // Pele colors the SVG through `--pele-*` custom properties, so the theme is
  // a style on the wrapper and switching light/dark needs no re-render. Light
  // mode uses the renderers' default palette, so the preview looks like the
  // page. Dark mode builds one from Strapi's own colors, with the node fills
  // mixed from bg/fg. Its accent is primary600, which the dark theme makes the
  // light one (primary500 is a deep blue that vanishes on the background), and
  // edges are a light grey. `bg` is what edge labels are masked with, so it is
  // the block's background either way.
  const colors = theme?.colors as unknown as Record<string, string> | undefined;
  const palette: DiagramColors = isDark
    ? {
        bg: colors?.neutral100,
        fg: colors?.neutral800,
        line: colors?.neutral500,
        accent: colors?.primary600,
      }
    : { ...DEFAULT_DIAGRAM_COLORS, bg: colors?.neutral100 };
  const themeVars = toPeleThemeVariables(palette) as React.CSSProperties;

  if (error) {
    return (
      <Typography variant="pi" textColor="danger600">
        {formatMessage({
          id: 'components.Blocks.diagram.invalid',
          defaultMessage: 'Invalid diagram',
        })}
      </Typography>
    );
  }

  if (rendered === null) {
    return (
      <Typography variant="pi" textColor="neutral400">
        …
      </Typography>
    );
  }

  // The natural width lets the source editor's preview show the diagram at its
  // own size, capped to the pane, so its zoom controls have something to scale.
  const style = {
    ...themeVars,
    '--bb-diagram-width': `${rendered.width}px`,
  } as React.CSSProperties;

  return (
    // eslint-disable-next-line react/no-danger
    <span style={style} dangerouslySetInnerHTML={{ __html: rendered.svg }} />
  );
};

/* ---------------------------------------------------------------------------
 * Insert / convert helper (shared by toolbar selector, slash command,
 * auto-transform)
 * -------------------------------------------------------------------------*/

/**
 * Convert the currently selected block into a (block) diagram node.
 * Re-inserts a clean node so no stale text is left in the void's children.
 */
const setBlockDiagram = (editor: Editor) => {
  const path = baseHandleConvert<DiagramElement>(editor, {
    type: 'diagram',
    format: 'mermaid',
    value: '',
    children: [{ type: 'text', text: '' }],
  });

  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      {
        type: 'diagram',
        format: 'mermaid',
        value: '',
        children: [{ type: 'text', text: '' }],
      } as unknown as CustomElement,
      { at: path, select: true }
    );
  }
};

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const BlockDiagramWrapper = styled.div<{ $selected: boolean; $empty: boolean }>`
  margin: ${({ theme }) => theme.spaces[2]} 0;
  padding: ${({ theme }) => theme.spaces[4]};
  text-align: center;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.primary600 : theme.colors.neutral200};
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme, $empty }) =>
    $empty ? theme.colors.neutral500 : theme.colors.neutral800};
  overflow-x: auto;

  svg {
    max-width: 100%;
    height: auto;
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

/* ---------------------------------------------------------------------------
 * Element component (renders + edits block diagrams)
 * -------------------------------------------------------------------------*/

const DiagramElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const diagram = element as unknown as DiagramElement;
  const { formatMessage } = useIntl();
  const { editor, disabled } = useBlocksEditorContext('Diagram');
  const theme = useTheme();
  const isDark = isDarkBackground(theme?.colors?.neutral0 as string);

  const [open, setOpen] = React.useState(
    diagram.value.trim() === '' && !disabled
  );
  const [source, setSource] = React.useState(diagram.value);

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, diagram);
    } catch {
      return null;
    }
  };

  const removeNode = () => {
    const path = getPath();
    if (!path) return;
    // Replace with an empty paragraph so the editor never ends up empty
    Transforms.setNodes(
      editor,
      { type: 'paragraph' } as Partial<CustomElement>,
      {
        at: path,
      }
    );
    Transforms.unsetNodes(editor, ['value', 'format'], { at: path });
  };

  const handleSave = () => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(
        editor,
        { value: source } as Partial<DiagramElement>,
        { at: path }
      );
    }
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleRemove = () => {
    removeNode();
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleClose = () => {
    // A node that was never committed (no saved value) is discarded on dismiss;
    // otherwise we just revert any unsaved edits to the source.
    if (diagram.value.trim() === '') {
      removeNode();
    } else {
      setSource(diagram.value);
    }
    setOpen(false);
  };

  const isEmpty = diagram.value.trim() === '';

  const preview = isEmpty ? (
    <Typography variant="pi" textColor="neutral500">
      {formatMessage({
        id: 'components.Blocks.diagram.placeholder',
        defaultMessage: 'Add a Mermaid diagram',
      })}
    </Typography>
  ) : (
    <MermaidContent value={diagram.value} isDark={isDark} />
  );

  const editorModal = (
    <SourceEditorModal
      open={open && !disabled}
      title={formatMessage({
        id: 'components.Blocks.diagram.modal.title',
        defaultMessage: 'Edit Mermaid diagram',
      })}
      label={formatMessage({
        id: 'components.Blocks.diagram.label',
        defaultMessage: 'Mermaid',
      })}
      placeholder={'graph TD\n    A[Start] --> B[End];'}
      source={source}
      onSourceChange={setSource}
      renderPreview={(value) => (
        <MermaidContent value={value} isDark={isDark} />
      )}
      onSave={handleSave}
      onRemove={handleRemove}
      onClose={handleClose}
    />
  );

  return (
    <div {...attributes} contentEditable={false}>
      <BlockDiagramWrapper
        $selected={open}
        $empty={isEmpty}
        onClick={() => !disabled && setOpen(true)}
      >
        {preview}
      </BlockDiagramWrapper>
      {editorModal}
      <span style={{ display: 'none' }}>{children}</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: diagram nodes are void blocks
 * -------------------------------------------------------------------------*/

const withDiagram = (editor: Editor): Editor => {
  const { isVoid } = editor;

  editor.isVoid = (element) =>
    isDiagramNode(element as CustomElement) ? true : isVoid(element);

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const diagramBlocks: Pick<BlocksStore, 'diagram'> = {
  diagram: {
    renderElement: (props) => <DiagramElementComponent {...props} />,
    icon: DiagramIcon,
    label: {
      id: 'components.Blocks.blocks.diagram',
      defaultMessage: 'Diagram',
    },
    matchNode: (node) => (node as { type?: string }).type === 'diagram',
    isInBlocksSelector: true,
    handleConvert(editor) {
      setBlockDiagram(editor);
    },
    snippets: ['```mermaid'],
  },
};

export { diagramBlocks, withDiagram, setBlockDiagram, DiagramIcon };
