import * as React from 'react';
import {
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  BulletList,
  NumberList,
  Quotes,
  Code,
  Image,
  Check,
  Minus,
  GridNine,
  Play,
  CaretDown,
} from '@strapi/icons';
import { Portal } from '@strapi/design-system';
import { Editor, Range, Transforms } from 'slate';
import { ReactEditor, useSlate } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';
import { MENU_WIDTH, type Placement, placeAt } from './utils/menuPlacement';
import { insertCallout, VARIANTS, VARIANT_ORDER } from './Blocks/Callout';
import { insertDetails } from './Blocks/Details';
import { insertEmbed } from './Blocks/Embed';
import { setBlockDiagram, DiagramIcon } from './Blocks/Diagram';
import { insertHorizontalLine } from './Blocks/HorizontalLine';
import { setBlockMath, MathIcon } from './Blocks/Math';
import { insertTable } from './Blocks/Table';
import { insertVideo } from './Blocks/Video';
import {
  blockLabelDescriptor,
  getRegisteredBlocks,
  isOfferedInMenus,
} from '../../blockRegistry';
import { isSlashCommandEnabled } from '../../features';

interface SlashCommand {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  action: (editor: Editor) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'paragraph',
    label: 'Text',
    icon: Paragraph,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'paragraph' } as any);
    },
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    icon: HeadingOne,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 1 } as any);
    },
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    icon: HeadingTwo,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 2 } as any);
    },
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    icon: HeadingThree,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 3 } as any);
    },
  },
  {
    id: 'bulleted-list',
    label: 'Bulleted list',
    icon: BulletList,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'list-item' } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'unordered',
        children: [],
      } as any);
    },
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    icon: NumberList,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'list-item' } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'ordered',
        children: [],
      } as any);
    },
  },
  {
    id: 'todo-list',
    label: 'To-do list',
    icon: Check,
    action: (editor) => {
      Transforms.setNodes(editor, {
        type: 'list-item',
        checked: false,
      } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'todo',
        children: [],
      } as any);
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: Quotes,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'quote' } as any);
    },
  },
  {
    id: 'code',
    label: 'Code block',
    icon: Code,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'code' } as any);
    },
  },
  {
    id: 'video',
    label: 'Video',
    icon: Play,
    action: (editor) => {
      insertVideo(editor);
    },
  },
  {
    id: 'embed',
    label: 'Embed (iframe / URL)',
    icon: Code,
    action: (editor) => {
      insertEmbed(editor);
    },
  },
  {
    id: 'math',
    label: 'Math block',
    icon: MathIcon,
    action: (editor) => {
      setBlockMath(editor);
    },
  },
  {
    id: 'mermaid',
    label: 'Diagram (Mermaid)',
    icon: DiagramIcon,
    action: (editor) => {
      setBlockDiagram(editor);
    },
  },
  ...VARIANT_ORDER.map((variant) => ({
    id: `callout-${variant}`,
    label: `Callout: ${String(VARIANTS[variant].label.defaultMessage)}`,
    icon: VARIANTS[variant].icon,
    action: (editor: Editor) => {
      insertCallout(editor, variant);
    },
  })),
  {
    id: 'details',
    label: 'Details (collapsible)',
    icon: CaretDown,
    action: (editor) => {
      insertDetails(editor);
    },
  },
  {
    id: 'horizontal-line',
    label: 'Horizontal line',
    icon: Minus,
    action: (editor) => {
      insertHorizontalLine(editor);
    },
  },
  {
    id: 'table',
    label: 'Table',
    icon: GridNine,
    action: (editor) => {
      insertTable(editor);
    },
  },
];

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

/**
 * Fixed and portalled, for the same reason as the floating selection toolbar.
 * Positioned absolutely inside the editor it was clipped by the content area,
 * which is a scroll container - in a short document only the first entry was
 * visible below the last line (#203).
 */
const MenuWrapper = styled.div`
  position: fixed;
  z-index: 10;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.filterShadow};
  overflow-y: auto;
  width: ${MENU_WIDTH}px;
  padding: 4px;
`;

const MenuItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : 'transparent'};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral800};

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
    color: ${({ theme }) => theme.colors.primary600};
  }

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

/* ---------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------*/

const SlashCommandMenu = () => {
  const editor = useSlate();
  const { blocks, pluginOptions } = useBlocksEditorContext('SlashCommandMenu');
  const disabledKey = (
    (pluginOptions?.disabledFeatures as string[] | undefined) ?? []
  ).join(',');
  const [show, setShow] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  /** Re-measures from the caret, so the menu stays with the line it belongs to. */
  const measure = React.useCallback(() => {
    const { selection } = editor;
    if (!selection) return;
    try {
      const rect = ReactEditor.toDOMRange(
        editor as ReactEditor,
        selection
      ).getBoundingClientRect();
      setPlacement(placeAt(rect));
    } catch {
      // The DOM range can be briefly invalid mid-transform; keep the last spot.
    }
  }, [editor]);

  // Blocks other packages registered are appended after the built-ins, so the
  // list the user already knows keeps its order.
  const commands = React.useMemo(
    () =>
      [
        ...COMMANDS,
        ...getRegisteredBlocks()
          .filter(isOfferedInMenus)
          .map((definition): SlashCommand => ({
            id: definition.type,
            label: String(
              blockLabelDescriptor(definition).defaultMessage ?? definition.type
            ),
            icon: definition.icon!,
            action: (editor) => definition.insert?.(editor),
          })),
      ].filter((command) =>
        // The menu is its own list rather than a view of the block store, so
        // it has to be told which features this field turned off.
        isSlashCommandEnabled(
          command.id,
          new Set(disabledKey ? disabledKey.split(',') : [])
        )
      ),
    [disabledKey]
  );

  const filtered = React.useMemo(
    () =>
      search
        ? commands.filter((c) =>
            c.label.toLowerCase().includes(search.toLowerCase())
          )
        : commands,
    [commands, search]
  );

  // Detect "/" at start of empty block
  React.useEffect(() => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) {
      setShow(false);
      return;
    }

    const [node] = Editor.parent(editor, selection.anchor);
    const text =
      node.children?.length === 1 && 'text' in node.children[0]
        ? (node.children[0] as any).text
        : '';

    if (text.startsWith('/')) {
      setSearch(text.slice(1));
      setShow(true);
      setActiveIndex(0);
      measure();
    } else {
      setShow(false);
    }
  }, [editor.selection, editor.children, measure]);

  // Fixed positioning does not move with scrolling, so follow the caret while
  // the menu is open: the page, the editor's own content area and fullscreen
  // mode all scroll independently. Capture phase, because scroll does not
  // bubble.
  React.useEffect(() => {
    if (!show) return;
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [show, measure]);

  // Keep the highlighted command in view when the arrow keys move past the
  // visible part of a capped menu.
  React.useEffect(() => {
    if (!show) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [show, activeIndex]);

  const executeCommand = React.useCallback(
    (command: SlashCommand) => {
      // Delete the "/" text first
      const { selection } = editor;
      if (selection) {
        const [, parentPath] = Editor.parent(editor, selection.anchor);
        const start = Editor.start(editor, parentPath);
        Transforms.select(editor, {
          anchor: start,
          focus: selection.anchor,
        });
        Transforms.delete(editor);
      }
      command.action(editor);
      setShow(false);
      ReactEditor.focus(editor as ReactEditor);
    },
    [editor]
  );

  React.useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Run in the capture phase and stop propagation so the editor's own
      // Enter/Arrow handlers don't also fire (which would split the block and
      // leave the "/command" text behind).
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[activeIndex]) {
          executeCommand(filtered[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShow(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [show, filtered, activeIndex, executeCommand]);

  if (!show || filtered.length === 0 || !placement) return null;

  return (
    <Portal>
      <MenuWrapper ref={menuRef} contentEditable={false} style={placement}>
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <MenuItem
              key={cmd.id}
              $active={i === activeIndex}
              data-active={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand(cmd);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <Icon />
              {cmd.label}
            </MenuItem>
          );
        })}
      </MenuWrapper>
    </Portal>
  );
};

export { SlashCommandMenu };
