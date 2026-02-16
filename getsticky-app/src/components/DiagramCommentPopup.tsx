import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DiagramCommentPopupProps {
  boxIds: string[];
  boxLabels: string[];
  anchorRect: { top: number; left: number; width: number };
  onAddComment: (text: string) => void;
  onClose: () => void;
}

export default function DiagramCommentPopup({
  boxIds,
  boxLabels,
  anchorRect,
  onAddComment,
  onClose,
}: DiagramCommentPopupProps) {
  const [showInput, setShowInput] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setText('');
    setShowInput(false);
  };

  // Position above the anchor rect, centered
  const popupWidth = showInput ? 300 : 100;
  const popupLeft = anchorRect.left + anchorRect.width / 2 - popupWidth / 2;
  const popupTop = anchorRect.top - 44;

  return createPortal(
    <div
      className="nodrag nowheel"
      style={{
        position: 'fixed',
        top: popupTop,
        left: popupLeft,
        width: popupWidth,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'width 0.15s ease',
      }}
    >
      {!showInput ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInput(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #1e1b2e 0%, #0f0e1a 100%)',
            border: '1px solid #facc15',
            borderRadius: 6,
            padding: '6px 14px',
            color: '#facc15',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          Comment {boxIds.length > 1 ? `(${boxIds.length} boxes)` : ''}
        </button>
      ) : (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b2e 0%, #0f0e1a 100%)',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            borderRadius: 8,
            padding: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            width: '100%',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: 10,
              color: '#94a3b8',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {boxLabels.join(', ')}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Add a comment..."
              style={{
                flex: 1,
                background: '#1a202c',
                border: '1px solid #2d3748',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                color: '#e2e8f0',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              style={{
                background: '#6366f1',
                border: 'none',
                borderRadius: 4,
                padding: '5px 10px',
                fontSize: 11,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
