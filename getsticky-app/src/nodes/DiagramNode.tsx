import { Handle, Position, type Node } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

export type DiagramNodeData = {
  title?: string;
  mermaidCode: string;
  context?: string;
  editable?: boolean;
};

export type DiagramNode = Node<DiagramNodeData>;

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#4f46e5',
    lineColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    tertiaryColor: '#1a202c',
    background: '#0f1419',
    mainBkg: '#1a202c',
    secondBkg: '#2d3748',
    border1: '#4a5568',
    border2: '#2d3748',
    note: '#fbbf24',
    noteBkgColor: '#1a202c',
    noteTextColor: '#e2e8f0',
    noteBorderColor: '#fbbf24',
    textColor: '#e2e8f0',
    fontSize: '14px',
  },
});

function DiagramNodeComponent({ data, id }: { data: DiagramNodeData; id: string }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagramRef.current || !data.mermaidCode) return;

      try {
        setError(null);
        const { svg } = await mermaid.render(`diagram-${id}`, data.mermaidCode);
        diagramRef.current.innerHTML = svg;
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [data.mermaidCode, id]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAskAboutDiagram = () => {
    console.log('Ask about diagram:', id);
    // TODO: Create a new RichTextNode with diagram context
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%)',
        border: '1px solid #2d3748',
        borderRadius: '12px',
        padding: '0',
        width: isExpanded ? '800px' : '500px',
        maxWidth: isExpanded ? '800px' : '500px',
        boxShadow: isHovered
          ? '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 211, 238, 0.3)'
          : '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#22d3ee',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1f2e',
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2d3748',
          background: 'rgba(34, 211, 238, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#22d3ee',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22d3ee',
              display: 'inline-block',
            }}
          />
          {data.title || 'Architecture Diagram'}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowCode(!showCode)}
            style={{
              background: showCode ? 'rgba(34, 211, 238, 0.2)' : 'transparent',
              border: '1px solid #2d3748',
              color: showCode ? '#67e8f9' : '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2d3748';
            }}
            title="Toggle source code"
          >
            {'</>'}
          </button>
          <button
            onClick={handleExpand}
            style={{
              background: 'transparent',
              border: '1px solid #2d3748',
              color: '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2d3748';
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '⊟' : '⊞'}
          </button>
        </div>
      </div>

      {/* Diagram or Code View */}
      <div
        style={{
          padding: '20px',
          minHeight: '200px',
          maxHeight: isExpanded ? '600px' : '400px',
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      >
        {showCode ? (
          <pre
            style={{
              background: '#0d1117',
              border: '1px solid #2d3748',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#e2e8f0',
              fontFamily: 'Monaco, Courier New, monospace',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {data.mermaidCode}
          </pre>
        ) : error ? (
          <div
            style={{
              padding: '20px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
              Failed to render diagram
            </div>
            <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>
          </div>
        ) : (
          <div
            ref={diagramRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '150px',
            }}
          />
        )}
      </div>

      {/* Context Info */}
      {data.context && !showCode && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #2d3748',
            background: 'rgba(34, 211, 238, 0.03)',
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: '1.6',
          }}
        >
          <div style={{ fontWeight: 600, color: '#cbd5e0', marginBottom: '4px' }}>
            Context:
          </div>
          {data.context}
        </div>
      )}

      {/* Action Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #2d3748',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: isHovered ? 1 : 0.7,
          transition: 'opacity 0.2s ease',
        }}
      >
        <button
          onClick={handleAskAboutDiagram}
          style={{
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            color: '#67e8f9',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.2)';
            e.currentTarget.style.borderColor = '#22d3ee';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)';
          }}
        >
          Ask about this diagram
        </button>

        {data.editable && (
          <button
            style={{
              background: 'transparent',
              border: '1px solid #2d3748',
              color: '#94a3b8',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#475569';
              e.currentTarget.style.color = '#cbd5e0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2d3748';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Edit
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#22d3ee',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1f2e',
        }}
      />
    </div>
  );
}

export default memo(DiagramNodeComponent);
