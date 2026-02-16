import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Node } from '@xyflow/react';
import type { CommentThread, CommentMessage } from '../types/comments';
import { useAPI } from '../contexts/APIContext';

interface DiagramChainCommentsProps {
  chainBoxIds: string[];
  nodes: Node[];
  agentName: string;
}

// ---- Comment Card (px-based, standalone) ----

interface ChainCommentCardProps {
  thread: CommentThread;
  isActive: boolean;
  isLoading: boolean;
  agentName: string;
  onThreadClick: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onAddMessage: (threadId: string, text: string) => void;
}

function ChainCommentCard({
  thread,
  isActive,
  isLoading,
  agentName,
  onThreadClick,
  onResolve,
  onAddMessage,
}: ChainCommentCardProps) {
  const [expanded, setExpanded] = useState(isActive);
  const [reply, setReply] = useState('');
  const isResolved = thread.status === 'resolved';

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const handleReply = () => {
    const text = reply.trim();
    if (!text) return;
    onAddMessage(thread.id, text);
    setReply('');
  };

  return (
    <div
      onClick={() => onThreadClick(thread.id)}
      style={{
        width: 320,
        background: isActive
          ? 'rgba(250, 204, 21, 0.08)'
          : 'linear-gradient(135deg, #1e1b2e 0%, #0f0e1a 100%)',
        border: isActive
          ? '1px solid rgba(250, 204, 21, 0.3)'
          : '1px solid #2d3748',
        borderRadius: 8,
        boxShadow: isActive
          ? '0 4px 16px rgba(250, 204, 21, 0.1)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        opacity: isResolved ? 0.5 : 1,
        transition: 'all 0.15s ease',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Header */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
          onThreadClick(thread.id);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid rgba(45, 55, 72, 0.5)' : 'none',
          borderLeft: '3px solid #facc15',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#64748b',
            transition: 'transform 0.15s ease',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
            display: 'inline-block',
          }}
        >
          &#x25BE;
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: '#cbd5e0',
              fontStyle: 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            &ldquo;{thread.selectedText.length > 40
              ? thread.selectedText.slice(0, 40) + '...'
              : thread.selectedText}&rdquo;
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {isLoading && (
            <span className="comment-loading-dots" style={{ marginRight: 2 }}>
              <span className="comment-dot" />
              <span className="comment-dot" />
              <span className="comment-dot" />
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              color: '#4a5568',
              background: 'rgba(45, 55, 72, 0.5)',
              borderRadius: 8,
              padding: '1px 5px',
            }}
          >
            {thread.messages.length}
          </span>
          {isResolved && (
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>
              &#x2713;
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '8px 10px 10px', maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {thread.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  background:
                    msg.author === 'claude'
                      ? 'rgba(99, 102, 241, 0.1)'
                      : 'rgba(139, 92, 246, 0.08)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: msg.author === 'claude' ? '#818cf8' : '#a78bfa',
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {msg.author === 'claude' ? agentName : 'You'}
                </div>
                <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#818cf8',
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {agentName}
                </div>
                <span className="comment-loading-dots">
                  <span className="comment-dot" />
                  <span className="comment-dot" />
                  <span className="comment-dot" />
                </span>
              </div>
            )}
          </div>

          {/* Reply input */}
          {!isResolved && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReply();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Reply..."
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: '#1a202c',
                    border: '1px solid #2d3748',
                    borderRadius: 4,
                    padding: '5px 7px',
                    fontSize: 12,
                    color: '#e2e8f0',
                    outline: 'none',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReply();
                  }}
                  disabled={isLoading}
                  style={{
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: 4,
                    padding: '5px 7px',
                    fontSize: 11,
                    color: '#fff',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  Reply
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve(thread.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #10b981',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    color: '#10b981',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Resolve
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

export default function DiagramChainComments({
  chainBoxIds,
  nodes,
  agentName,
}: DiagramChainCommentsProps) {
  const api = useAPI();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreadIds, setLoadingThreadIds] = useState<Set<string>>(new Set());
  const rafRef = useRef<number>();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Create a stable portal container
  const [portalEl] = useState(() => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'auto';
    return el;
  });

  useEffect(() => {
    document.body.appendChild(portalEl);
    return () => {
      document.body.removeChild(portalEl);
    };
  }, [portalEl]);

  // Track position via rAF — directly mutate DOM style, no React re-renders
  // Clamp to viewport so the sidebar stays visible
  useEffect(() => {
    const SIDEBAR_WIDTH = 340;
    const MARGIN = 16;

    const update = () => {
      let maxRight = -Infinity;
      let minTop = Infinity;
      for (const boxId of chainBoxIds) {
        const el = document.querySelector(`[data-id="${boxId}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        maxRight = Math.max(maxRight, rect.right);
        minTop = Math.min(minTop, rect.top);
      }
      if (maxRight !== -Infinity && minTop !== Infinity) {
        const vw = window.innerWidth;
        // If sidebar would overflow viewport, clamp to the right edge
        let left = maxRight + MARGIN;
        if (left + SIDEBAR_WIDTH > vw) {
          left = vw - SIDEBAR_WIDTH - MARGIN;
        }
        portalEl.style.top = `${Math.max(8, minTop)}px`;
        portalEl.style.left = `${left}px`;
        portalEl.style.display = '';
      } else {
        portalEl.style.display = 'none';
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [chainBoxIds, portalEl]);

  // Collect all comments from all boxes in the chain
  const allThreads = useMemo(() => {
    const threads: CommentThread[] = [];
    for (const boxId of chainBoxIds) {
      const node = nodes.find((n) => n.id === boxId);
      if (node) {
        const comments: CommentThread[] = (node.data as any).comments || [];
        threads.push(...comments);
      }
    }
    return threads;
  }, [chainBoxIds, nodes]);

  // Build a map: threadId -> owning boxId (for updates)
  const threadOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const boxId of chainBoxIds) {
      const node = nodes.find((n) => n.id === boxId);
      if (node) {
        const comments: CommentThread[] = (node.data as any).comments || [];
        for (const thread of comments) {
          map.set(thread.id, boxId);
        }
      }
    }
    return map;
  }, [chainBoxIds, nodes]);

  // Listen for Claude comment responses
  useEffect(() => {
    const unsub = api.on('comment_claude_response', (response: any) => {
      const data = response.data || response;
      const { node_id, thread_id, message } = data;
      if (!chainBoxIds.includes(node_id)) return;

      setLoadingThreadIds((prev) => {
        const next = new Set(prev);
        next.delete(thread_id);
        return next;
      });

      // Add Claude's message to the thread and persist
      const node = nodesRef.current.find((n) => n.id === node_id);
      if (!node) return;
      const comments: CommentThread[] = (node.data as any).comments || [];
      const updated = comments.map((t) =>
        t.id === thread_id ? { ...t, messages: [...t.messages, message] } : t,
      );
      api.updateNode({ id: node_id, data: { comments: updated } });
    });
    return unsub;
  }, [api, chainBoxIds]);

  const handleThreadClick = useCallback((threadId: string) => {
    setActiveThreadId((prev) => (prev === threadId ? null : threadId));
  }, []);

  const handleResolve = useCallback(
    (threadId: string) => {
      const boxId = threadOwnerMap.get(threadId);
      if (!boxId) return;

      const node = nodes.find((n) => n.id === boxId);
      if (!node) return;

      const comments: CommentThread[] = (node.data as any).comments || [];
      const updated = comments.map((t) =>
        t.id === threadId ? { ...t, status: 'resolved' as const } : t,
      );

      api.updateNode({ id: boxId, data: { comments: updated } });
    },
    [api, nodes, threadOwnerMap],
  );

  const handleAddMessage = useCallback(
    (threadId: string, text: string) => {
      const boxId = threadOwnerMap.get(threadId);
      if (!boxId) return;

      const node = nodes.find((n) => n.id === boxId);
      if (!node) return;

      const comments: CommentThread[] = (node.data as any).comments || [];
      const newMsg: CommentMessage = {
        id: `msg-${Date.now()}`,
        author: 'user',
        text,
        createdAt: new Date().toISOString(),
      };

      const updated = comments.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, newMsg] } : t,
      );

      api.updateNode({ id: boxId, data: { comments: updated } });

      // Mark as loading and ask Claude
      setLoadingThreadIds((prev) => new Set(prev).add(threadId));

      const thread = comments.find((t) => t.id === threadId);
      if (thread) {
        api.askClaudeInComment(
          boxId,
          threadId,
          thread.selectedText,
          [...thread.messages, newMsg].map((m) => ({ author: m.author, text: m.text })),
        );
      }
    },
    [api, nodes, threadOwnerMap],
  );

  if (allThreads.length === 0) return null;

  // Sort threads by creation time
  const sortedThreads = [...allThreads].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return createPortal(
    <div
      className="nodrag nowheel"
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {sortedThreads.map((thread) => (
        <ChainCommentCard
          key={thread.id}
          thread={thread}
          isActive={thread.id === activeThreadId}
          isLoading={loadingThreadIds.has(thread.id)}
          agentName={agentName}
          onThreadClick={handleThreadClick}
          onResolve={handleResolve}
          onAddMessage={handleAddMessage}
        />
      ))}
    </div>,
    portalEl,
  );
}
