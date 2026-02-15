import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useAPI } from '../contexts/APIContext';
import { useGrabToDrag } from '../lib/gestures';

const MAX_FONT_CQW = 30;
const MIN_FONT_CQW = 2;
const DEFAULT_HEIGHT = 200;

const STICKY_COLORS: Record<string, { bg: string; text: string }> = {
  yellow:   { bg: '#fef08a', text: '#713f12' },
  blue:     { bg: '#bfdbfe', text: '#1e3a5f' },
  purple:   { bg: '#d8b4fe', text: '#3b0764' },
  pink:     { bg: '#fbcfe8', text: '#701a3e' },
  green:    { bg: '#bbf7d0', text: '#14532d' },
  teal:     { bg: '#a5f3fc', text: '#134e4a' },
  orange:   { bg: '#fed7aa', text: '#7c2d12' },
  rose:     { bg: '#fecdd3', text: '#881337' },
  lavender: { bg: '#c4b5fd', text: '#2e1065' },
  sage:     { bg: '#d1d5c4', text: '#3f4536' },
  peach:    { bg: '#fdd8b4', text: '#6b3410' },
};

export { STICKY_COLORS };

function StickyNoteNode({ id, data, selected }: NodeProps) {
  const api = useAPI();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);
  const [fontPx, setFontPx] = useState<number | null>(null);

  // Height is always fixed — font scales to fit. NodeResizer changes width only.
  const targetHeight = DEFAULT_HEIGHT;

  const handleSelectFocus = useCallback((x: number, y: number) => {
    const el = textRef.current;
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

  const color = (data.color as string) || 'yellow';
  const palette = STICKY_COLORS[color] || STICKY_COLORS.yellow;

  // Auto-fit font: measure with an offscreen clone to avoid disturbing React Flow
  const fitFont = useCallback(() => {
    const el = textRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const containerW = container.clientWidth;
    if (containerW === 0) return;

    const cqwToPx = (cqw: number) => (cqw / 100) * containerW;
    const maxPx = cqwToPx(MAX_FONT_CQW);
    const minPx = cqwToPx(MIN_FONT_CQW);

    // Create an offscreen clone for measurement — never touches the real DOM's fontSize
    const clone = el.cloneNode(true) as HTMLDivElement;
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    clone.style.width = `${el.clientWidth}px`;
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.padding = window.getComputedStyle(el).padding;
    clone.style.lineHeight = '1.5';
    clone.style.wordBreak = 'break-word';
    clone.contentEditable = 'false';
    container.appendChild(clone);

    // Binary search for largest font that fits in targetHeight
    let lo = minPx;
    let hi = maxPx;

    clone.style.fontSize = `${hi}px`;
    if (clone.scrollHeight <= targetHeight) {
      container.removeChild(clone);
      setFontPx(hi);
      return;
    }

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      clone.style.fontSize = `${mid}px`;
      if (clone.scrollHeight <= targetHeight) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    container.removeChild(clone);
    setFontPx(lo);
  }, [targetHeight]);

  // Set initial text content once on mount
  useEffect(() => {
    if (textRef.current && !initializedRef.current) {
      textRef.current.innerText = (data.text as string) || '';
      initializedRef.current = true;
      fitFont();
    }
  }, []);

  // Sync text content from data prop when it changes externally
  useEffect(() => {
    if (!textRef.current || !initializedRef.current) return;
    if (document.activeElement !== textRef.current) {
      const currentText = textRef.current.innerText;
      const newText = (data.text as string) || '';
      if (currentText !== newText) {
        textRef.current.innerText = newText;
        fitFont();
      }
    }
  }, [data.text, fitFont]);

  // Re-fit font when targetHeight or container width changes
  useEffect(() => {
    fitFont();
  }, [targetHeight, fitFont]);

  // Re-fit on container resize (e.g. NodeResizer drag)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => fitFont());
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitFont]);

  const handleInput = useCallback(() => {
    if (!textRef.current) return;
    const text = textRef.current.innerText;
    fitFont();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.updateNode({ id, data: { text } });
    }, 500);
  }, [id, api, fitFont]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={containerOnMouseDown}
      style={{
        width: '100%',
        height: targetHeight,
        background: palette.bg,
        color: palette.text,
        borderRadius: '2px',
        boxShadow: selected
          ? `0 4px 16px rgba(0,0,0,0.25), 0 0 0 2px ${palette.text}40`
          : '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        fontFamily: "'Inter', -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        cursor: selected ? 'text' : 'grab',
        transition: 'box-shadow 0.2s',
        overflow: 'hidden',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={50}
        lineStyle={{
          borderColor: 'transparent',
          borderWidth: 6,
          background: 'transparent',
        }}
        handleStyle={{
          width: 0,
          height: 0,
          opacity: 0,
          border: 'none',
        }}
      />

      {/* Folded corner */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '10cqw',
          height: '10cqw',
          background: `linear-gradient(135deg, ${palette.bg} 50%, ${palette.text}15 50%)`,
          borderTopLeftRadius: '2cqw',
          pointerEvents: 'none',
        }}
      />

      {/* Editable text area */}
      <div
        ref={textRef}
        className={editableClassName}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={(e) => e.stopPropagation()}
        data-placeholder="Type here..."
        style={{
          flex: 1,
          padding: '7cqw 8cqw',
          fontSize: fontPx != null ? `${fontPx}px` : '7cqw',
          lineHeight: '1.5',
          outline: 'none',
          cursor: 'inherit',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

export default memo(StickyNoteNode);
