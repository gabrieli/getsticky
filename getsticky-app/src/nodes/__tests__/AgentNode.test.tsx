import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * AgentNode - The Chat Bubble
 *
 * A styled card that shows:
 * - The user's question
 * - Claude's response (rendered as rich markdown)
 * - Action buttons: Branch, Edit, Regenerate
 * - Stored context metadata
 *
 * This is the atomic unit of the multi-node conversation system.
 */

describe('AgentNode', () => {
  test.todo('renders user question and agent response');

  test.todo('displays markdown content with syntax highlighting');

  test.todo('shows Branch, Edit, and Regenerate action buttons');

  test.todo('displays context metadata');

  test.todo('handles branch action to create child node');

  test.todo('handles edit action to modify response');

  test.todo('handles regenerate action to get new response');

  test.todo('applies correct styling for different node states');
});
