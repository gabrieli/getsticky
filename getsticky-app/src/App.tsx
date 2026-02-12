import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ExampleNode from './nodes/ExampleNode';
import AgentNode from './nodes/AgentNode';
import RichTextNode from './nodes/RichTextNode';
import DiagramNode from './nodes/DiagramNode';
import TerminalNode from './nodes/TerminalNode';
import { getAPI } from './lib/api';
import { APIProvider } from './contexts/APIContext';
import './App.css';

const nodeTypes: NodeTypes = {
  exampleNode: ExampleNode,
  agentNode: AgentNode,
  richTextNode: RichTextNode,
  diagramNode: DiagramNode,
  terminalNode: TerminalNode,
};

// Initial demo nodes
const demoNodes: Node[] = [
  {
    id: 'question-1',
    type: 'richTextNode',
    position: { x: 100, y: 200 },
    data: {
      content: '',
      placeholder: 'Ask Claude about your codebase...',
    },
  },
];

const demoEdges: Edge[] = [];

function AppContent() {
  const [nodes, setNodes] = useState<Node[]>(demoNodes);
  const [edges, setEdges] = useState<Edge[]>(demoEdges);
  const apiRef = useRef(getAPI());
  const [isConnected, setIsConnected] = useState(false);

  // Connect to WebSocket on mount
  useEffect(() => {
    const api = apiRef.current;

    // Connect to backend
    api.connect().then(() => {
      console.log('[App] Connected to backend');
      setIsConnected(true);

      // Request initial state
      api.requestInitialState();
    }).catch((error) => {
      console.error('[App] Failed to connect:', error);
    });

    // Handle node_created events
    const unsubNodeCreated = api.on('node_created', (data: any) => {
      console.log('[App] node_created:', data);

      const newNode: Node = {
        id: data.id || `node-${Date.now()}`,
        type: data.nodeType || 'agentNode',
        position: data.position || { x: Math.random() * 500 + 200, y: Math.random() * 300 + 200 },
        data: data.data || {},
      };

      setNodes((prev) => [...prev, newNode]);
    });

    // Handle node_updated events
    const unsubNodeUpdated = api.on('node_updated', (data: any) => {
      console.log('[App] node_updated:', data);

      setNodes((prev) =>
        prev.map((node) =>
          node.id === data.id
            ? { ...node, data: { ...node.data, ...data.data } }
            : node
        )
      );
    });

    // Handle edge_created events
    const unsubEdgeCreated = api.on('edge_created', (data: any) => {
      console.log('[App] edge_created:', data);

      const newEdge: Edge = {
        id: data.id || `edge-${Date.now()}`,
        source: data.source,
        target: data.target,
        animated: data.animated,
        style: data.style,
      };

      setEdges((prev) => [...prev, newEdge]);
    });

    // Handle success with initial_state
    const unsubSuccess = api.on('success', (response: any) => {
      if (response.data?.type === 'initial_state') {
        console.log('[App] initial_state:', response.data);

        if (response.data.nodes && Array.isArray(response.data.nodes)) {
          // Convert database nodes to React Flow format
          const flowNodes = response.data.nodes.map((dbNode: any) => {
            const content = JSON.parse(dbNode.content);
            return {
              id: dbNode.id,
              type: dbNode.type === 'conversation' ? 'agentNode' :
                    dbNode.type === 'richtext' ? 'richTextNode' :
                    dbNode.type === 'diagram' ? 'diagramNode' : 'terminalNode',
              position: content.position || { x: Math.random() * 400, y: Math.random() * 300 },
              data: content,
            };
          });

          // Keep demo nodes if backend returns empty state
          setNodes(flowNodes.length > 0 ? flowNodes : demoNodes);
        }
        if (response.data.edges && Array.isArray(response.data.edges)) {
          // Convert database edges to React Flow format
          const flowEdges = response.data.edges.map((dbEdge: any) => ({
            id: dbEdge.id,
            source: dbEdge.source_id,
            target: dbEdge.target_id,
            label: dbEdge.label,
            animated: true,
          }));
          setEdges(flowEdges);
        }
      }
    });

    // Handle Claude responses
    const unsubClaudeResponse = api.on('claude_response', (response: any) => {
      console.log('[App] claude_response FULL STRUCTURE:', JSON.stringify(response, null, 2));

      // Defensive: Handle both possible formats
      // Format A: { data: { node: {...} } }
      // Format B: { questionNodeId, responseNode: {...} }

      let node = null;
      if (response.data?.node) {
        // Format A (from FRONTEND_API.md)
        node = response.data.node;
        console.log('[App] Using Format A: response.data.node');
      } else if (response.responseNode) {
        // Format B (from team-lead's message)
        node = response.responseNode;
        console.log('[App] Using Format B: response.responseNode');
      }

      if (node) {
        const newNode: Node = {
          id: node.id,
          type: 'agentNode',
          position: node.position || { x: Math.random() * 400 + 300, y: Math.random() * 300 + 200 },
          data: {
            question: JSON.parse(node.content).question,
            response: JSON.parse(node.content).response,
          },
        };

        setNodes((prev) => [...prev, newNode]);
        console.log('[App] Created AgentNode:', newNode.id);
      } else {
        console.warn('[App] Could not extract node from claude_response:', response);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubNodeCreated();
      unsubNodeUpdated();
      unsubEdgeCreated();
      unsubSuccess();
      unsubClaudeResponse();
      api.disconnect();
    };
  }, []);

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => {
      // Apply changes locally
      const newNodes = [...nds];

      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          const node = newNodes.find(n => n.id === change.id);
          if (node) {
            node.position = change.position;
            // Sync to backend
            apiRef.current.updateNode({
              id: change.id,
              position: change.position,
            });
          }
        } else if (change.type === 'remove') {
          apiRef.current.deleteNode(change.id);
        }
      });

      return newNodes;
    });
  }, []);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => {
      const newEdges = [...eds];

      changes.forEach((change: any) => {
        if (change.type === 'remove') {
          apiRef.current.deleteEdge(change.id);
        }
      });

      return newEdges;
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const edge: Edge = {
      id: `edge-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      animated: true,
    };

    setEdges((eds) => [...eds, edge]);

    // Sync to backend
    apiRef.current.createEdge({
      source: connection.source!,
      target: connection.target!,
      animated: true,
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Connection indicator */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          padding: '8px 12px',
          background: isConnected ? '#10b981' : '#ef4444',
          color: 'white',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        {isConnected ? '● Connected' : '○ Disconnected'}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'agentNode':
                return '#6366f1';
              case 'richTextNode':
                return '#8b5cf6';
              case 'diagramNode':
                return '#22d3ee';
              case 'terminalNode':
                return '#10b981';
              default:
                return '#4a5568';
            }
          }}
          style={{
            backgroundColor: '#1a202c',
          }}
        />
      </ReactFlow>
    </div>
  );
}

function App() {
  return (
    <APIProvider>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </APIProvider>
  );
}

export default App;
