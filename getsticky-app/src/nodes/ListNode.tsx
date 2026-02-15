import { memo, useCallback, useRef, useEffect } from 'react';
import { type NodeProps, useStore } from '@xyflow/react';
import { useAPI } from '../contexts/APIContext';
import { useGrabToDrag } from '../lib/gestures';

export type ListNodeData = {
  title?: string;
  position?: { x: number; y: number };
};

// Fixed single-column layout constants — item matches default sticky note width (200px)
const ITEM_WIDTH = 200;
const ITEM_HEIGHT = 200;
const GAP = 12;
const PADDING = 16;
const HEADER_HEIGHT = 48;

/** Total outer width of the list (matches the + box width) */
export const LIST_WIDTH = PADDING * 2 + ITEM_WIDTH;

/**
 * Compute single-column layout positions for list children.
 */
export function computeListLayout(itemCount: number) {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < itemCount; i++) {
    positions.push({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING + i * (ITEM_HEIGHT + GAP),
    });
  }

  const nextSlot = {
    x: PADDING,
    y: HEADER_HEIGHT + PADDING + itemCount * (ITEM_HEIGHT + GAP),
  };

  return { positions, nextSlot, itemWidth: ITEM_WIDTH, itemHeight: ITEM_HEIGHT };
}

function ListNode({ id, data, selected }: NodeProps) {
  const api = useAPI();
  const titleRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);

  // Reactive child count — re-renders when children are added/removed
  const childCount = useStore(
    useCallback((state: any) => state.nodes.filter((n: any) => n.parentId === id).length, [id])
  );
  const layout = computeListLayout(childCount);

  const handleSelectFocus = useCallback((x: number, y: number) => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const { containerOnMouseDown, editableClassName } = useGrabToDrag(selected, handleSelectFocus);

  // Set initial title once on mount
  useEffect(() => {
    if (titleRef.current && !initializedRef.current) {
      titleRef.current.innerText = (data.title as string) || 'New List';
      initializedRef.current = true;
    }
  }, []);

  // Sync title from data prop when changed externally
  useEffect(() => {
    if (!titleRef.current || !initializedRef.current) return;
    if (document.activeElement !== titleRef.current) {
      const currentText = titleRef.current.innerText;
      const newText = (data.title as string) || '';
      if (currentText !== newText) {
        titleRef.current.innerText = newText;
      }
    }
  }, [data.title]);

  const handleTitleInput = useCallback(() => {
    if (!titleRef.current) return;
    const title = titleRef.current.innerText;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.updateNode({ id, data: { title } });
    }, 500);
  }, [id, api]);

  const handleAddItem = useCallback(() => {
    api.createNode({
      type: 'stickyNote',
      position: layout.nextSlot,
      data: {
        text: '',
        color: 'yellow',
        order: childCount,
        status: 'todo',
        position: layout.nextSlot,
      },
      parentId: id,
    });
  }, [api, id, layout.nextSlot, childCount]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      onMouseDown={containerOnMouseDown}
      style={{
        width: LIST_WIDTH,
        borderRadius: '12px',
        border: selected ? '1.5px solid #6366f1' : '1px solid #2d3748',
        background: 'linear-gradient(180deg, rgba(30, 27, 46, 0.95) 0%, rgba(15, 14, 26, 0.9) 100%)',
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        cursor: selected ? 'default' : 'grab',
        boxShadow: selected
          ? '0 8px 24px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.2)'
          : '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #2d3748',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px', opacity: 0.6 }}>&#9776;</span>
        <div
          ref={titleRef}
          className={editableClassName}
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onKeyDown={(e) => e.stopPropagation()}
          data-placeholder="List title..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#a5b4fc',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: selected ? 'text' : 'inherit',
            minHeight: '18px',
          }}
        />
      </div>

      {/* Content area - children are rendered by React Flow */}
      <div style={{ position: 'relative', minHeight: layout.nextSlot.y + ITEM_HEIGHT + PADDING - HEADER_HEIGHT }}>
        {/* Add item button */}
        <button
          onClick={handleAddItem}
          style={{
            position: 'absolute',
            left: layout.nextSlot.x,
            top: layout.nextSlot.y - HEADER_HEIGHT,
            width: ITEM_WIDTH,
            height: ITEM_HEIGHT,
            background: 'transparent',
            border: '2px dashed #334155',
            borderRadius: '4px',
            color: '#475569',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.color = '#818cf8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.color = '#475569';
          }}
          title="Add item to list"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default memo(ListNode);
