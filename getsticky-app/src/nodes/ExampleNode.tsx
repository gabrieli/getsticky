import { Handle, Position, type Node } from '@xyflow/react';
import { memo } from 'react';

export type ExampleNodeData = {
  label: string;
  description?: string;
};

export type ExampleNode = Node<ExampleNodeData>;

function ExampleNodeComponent({ data }: { data: ExampleNodeData }) {
  return (
    <div style={{
      padding: '16px',
      borderRadius: '8px',
      border: '2px solid #4a5568',
      background: '#1a202c',
      color: '#e2e8f0',
      minWidth: '250px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    }}>
      <Handle type="target" position={Position.Left} />

      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
          {data.label}
        </h3>
        {data.description && (
          <p style={{ margin: 0, fontSize: '14px', color: '#a0aec0' }}>
            {data.description}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ExampleNodeComponent);
