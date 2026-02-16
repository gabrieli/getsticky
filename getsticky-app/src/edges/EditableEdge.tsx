import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { useAPI } from '../contexts/APIContext';

function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
}: EdgeProps) {
  const api = useAPI();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  const commitLabel = useCallback(() => {
    const value = inputRef.current?.value.trim() ?? '';
    api.updateEdge(id, value);
    setEditing(false);
  }, [id, api]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') commitLabel();
    if (e.key === 'Escape') setEditing(false);
  }, [commitLabel]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const labelStr = typeof label === 'string' ? label : '';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />

      {editing ? (
        <foreignObject
          x={labelX - 60}
          y={labelY - 12}
          width={120}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <input
            ref={inputRef}
            defaultValue={labelStr}
            onBlur={commitLabel}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              height: '100%',
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '11px',
              textAlign: 'center',
              outline: 'none',
              padding: '0 4px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          />
        </foreignObject>
      ) : (
        <foreignObject
          x={labelX - 60}
          y={labelY - 10}
          width={120}
          height={20}
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{ pointerEvents: 'all' }}
        >
          <div
            onDoubleClick={handleDoubleClick}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cbd5e1',
              fontSize: '11px',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {labelStr}
          </div>
        </foreignObject>
      )}
    </>
  );
}

export default memo(EditableEdge);
