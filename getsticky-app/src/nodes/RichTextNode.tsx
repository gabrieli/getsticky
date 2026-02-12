import { Handle, Position, type Node } from '@xyflow/react';
import { memo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useAPI } from '../contexts/APIContext';

const lowlight = createLowlight(common);

export type RichTextNodeData = {
  content?: string;
  placeholder?: string;
  onSubmit?: (content: string) => void;
};

export type RichTextNode = Node<RichTextNodeData>;

function RichTextNodeComponent({ data, id }: { data: RichTextNodeData; id: string }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const api = useAPI();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: data.placeholder || 'Ask Claude anything...',
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: data.content || '',
    onUpdate: () => {
      // Auto-save functionality could go here
      console.log('Content updated for node:', id);
    },
    editorProps: {
      attributes: {
        style: 'outline: none; min-height: 80px;',
      },
    },
  });

  const handleSubmit = () => {
    if (!editor) return;
    const content = editor.getText();
    if (content.trim()) {
      // Call custom handler if provided
      data.onSubmit?.(content);

      // Send to backend via WebSocket
      // Don't pass demo node IDs as parents (they're not in the database)
      const parentId = id.startsWith('question-') || id.startsWith('terminal-') || id.startsWith('diagram-') ? undefined : id;
      api.askClaude(content, undefined, parentId);

      // Clear the editor
      editor.commands.clearContent();

      console.log('[RichTextNode] Submitted question:', content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #1e1b2e 0%, #0f0e1a 100%)',
        border: isFocused
          ? '1px solid #6366f1'
          : '1px solid #2d3748',
        borderRadius: '12px',
        padding: '0',
        minWidth: '400px',
        maxWidth: '600px',
        boxShadow: isFocused
          ? '0 8px 24px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.3)'
          : isHovered
          ? '0 6px 16px rgba(0, 0, 0, 0.4)'
          : '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      onKeyDown={handleKeyDown}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid #1e1b2e',
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2d3748',
          background: 'rgba(139, 92, 246, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#8b5cf6',
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
              background: '#8b5cf6',
              display: 'inline-block',
            }}
          />
          Your Question
        </div>

        {/* Formatting toolbar */}
        {editor && isFocused && (
          <div
            style={{
              display: 'flex',
              gap: '4px',
            }}
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              style={{
                background: editor.isActive('bold') ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: '1px solid #2d3748',
                color: editor.isActive('bold') ? '#c4b5fd' : '#94a3b8',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Bold (⌘B)"
            >
              B
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              style={{
                background: editor.isActive('italic') ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: '1px solid #2d3748',
                color: editor.isActive('italic') ? '#c4b5fd' : '#94a3b8',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontStyle: 'italic',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Italic (⌘I)"
            >
              I
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              style={{
                background: editor.isActive('code') ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: '1px solid #2d3748',
                color: editor.isActive('code') ? '#c4b5fd' : '#94a3b8',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Code (⌘E)"
            >
              {'<>'}
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              style={{
                background: editor.isActive('codeBlock') ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: '1px solid #2d3748',
                color: editor.isActive('codeBlock') ? '#c4b5fd' : '#94a3b8',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Code Block"
            >
              {'{ }'}
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          padding: '20px',
          fontSize: '14px',
          color: '#e2e8f0',
          lineHeight: '1.7',
          minHeight: '120px',
        }}
      >
        <EditorContent
          editor={editor}
          style={{
            outline: 'none',
          }}
        />

        <style>
          {`
            .tiptap {
              outline: none;
            }
            .tiptap p.is-editor-empty:first-child::before {
              color: #64748b;
              content: attr(data-placeholder);
              float: left;
              height: 0;
              pointer-events: none;
            }
            .tiptap p {
              margin: 0 0 12px 0;
            }
            .tiptap p:last-child {
              margin-bottom: 0;
            }
            .tiptap code {
              background-color: #2d3748;
              color: #f7fafc;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 13px;
              font-family: 'Monaco', 'Courier New', monospace;
            }
            .tiptap pre {
              background: #1a202c;
              border: 1px solid #2d3748;
              border-radius: 8px;
              color: #e2e8f0;
              font-family: 'Monaco', 'Courier New', monospace;
              padding: 16px;
              margin: 12px 0;
              overflow-x: auto;
            }
            .tiptap pre code {
              background: none;
              padding: 0;
              font-size: 13px;
              color: inherit;
            }
            .tiptap strong {
              font-weight: 600;
              color: #f7fafc;
            }
            .tiptap em {
              font-style: italic;
              color: #cbd5e0;
            }
            .tiptap ul, .tiptap ol {
              margin-left: 20px;
              margin-bottom: 12px;
            }
            .tiptap li {
              margin-bottom: 4px;
            }
          `}
        </style>
      </div>

      {/* Footer with Submit Button */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #2d3748',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          <kbd
            style={{
              background: '#1a202c',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #2d3748',
              fontSize: '10px',
            }}
          >
            ⌘
          </kbd>
          {' + '}
          <kbd
            style={{
              background: '#1a202c',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #2d3748',
              fontSize: '10px',
            }}
          >
            Enter
          </kbd>
          {' to submit'}
        </div>

        <button
          onClick={handleSubmit}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            border: 'none',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
          }}
        >
          Ask Claude
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid #1e1b2e',
        }}
      />
    </div>
  );
}

export default memo(RichTextNodeComponent);
