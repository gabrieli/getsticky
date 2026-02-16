import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo, useCallback, useRef, useEffect } from 'react';
import { useAPI } from '../contexts/APIContext';
import { useGrabToDrag } from '../lib/gestures';

export type DiagramBoxCategory = 'frontend' | 'server' | 'database' | 'external';

export type DiagramBoxData = {
  label: string;
  subtitle?: string;
  category?: DiagramBoxCategory;
};

export type DiagramBoxNode = Node<DiagramBoxData>;

const categoryColors: Record<DiagramBoxCategory, { bg: string; border: string }> = {
  frontend: { bg: '#ede9fe', border: '#c4b5fd' },
  server:   { bg: '#e0e7ff', border: '#a5b4fc' },
  database: { bg: '#dbeafe', border: '#93c5fd' },
  external: { bg: '#e8e0f0', border: '#bbadd4' },
};

const defaultColors = { bg: '#e0e7ff', border: '#a5b4fc' };

function DiagramBoxNodeComponent({ id, data, selected }: NodeProps) {
  const api = useAPI();
  const labelRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);

  const handleSelectFocus = useCallback((x: number, y: number) => {
    // Try to focus the element under the click point
    const el = document.elementFromPoint(x, y);
    if (el === subtitleRef.current) {
      subtitleRef.current?.focus();
    } else {
      labelRef.current?.focus();
    }
    // Place caret at click position
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const { containerOnMouseDown, editableClassName } = useGrabToDrag(selected, handleSelectFocus);

  const colors = categoryColors[(data.category as DiagramBoxCategory) || 'server'] || defaultColors;

  // Set initial text on mount
  useEffect(() => {
    if (!initializedRef.current) {
      if (labelRef.current) {
        labelRef.current.innerText = (data.label as string) || '';
      }
      if (subtitleRef.current) {
        subtitleRef.current.innerText = (data.subtitle as string) || '';
      }
      initializedRef.current = true;
    }
  }, []);

  // Sync from external data changes (e.g. MCP updates)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (labelRef.current && document.activeElement !== labelRef.current) {
      const current = labelRef.current.innerText;
      const next = (data.label as string) || '';
      if (current !== next) labelRef.current.innerText = next;
    }
    if (subtitleRef.current && document.activeElement !== subtitleRef.current) {
      const current = subtitleRef.current.innerText;
      const next = (data.subtitle as string) || '';
      if (current !== next) subtitleRef.current.innerText = next;
    }
  }, [data.label, data.subtitle]);

  const persistUpdate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const label = labelRef.current?.innerText || '';
      const subtitle = subtitleRef.current?.innerText || '';
      api.updateNode({ id, data: { label, subtitle } });
    }, 500);
  }, [id, api]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      onMouseDown={containerOnMouseDown}
      style={{
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '10px 16px',
        minWidth: '140px',
        maxWidth: '220px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        cursor: selected ? 'text' : 'grab',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: colors.border, width: '6px', height: '6px', border: 'none' }}
      />

      <div
        ref={labelRef}
        className={editableClassName}
        contentEditable
        suppressContentEditableWarning
        onInput={persistUpdate}
        onKeyDown={(e) => e.stopPropagation()}
        data-placeholder="Label"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#1e293b',
          lineHeight: 1.4,
          textAlign: 'center',
          outline: 'none',
          cursor: 'inherit',
          minHeight: '1.4em',
        }}
      />

      <div
        ref={subtitleRef}
        className={editableClassName}
        contentEditable
        suppressContentEditableWarning
        onInput={persistUpdate}
        onKeyDown={(e) => e.stopPropagation()}
        data-placeholder="Subtitle"
        style={{
          fontSize: '10px',
          color: '#64748b',
          marginTop: '2px',
          textAlign: 'center',
          lineHeight: 1.3,
          outline: 'none',
          cursor: 'inherit',
          minHeight: '1.3em',
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: colors.border, width: '6px', height: '6px', border: 'none' }}
      />
    </div>
  );
}

export default memo(DiagramBoxNodeComponent);
