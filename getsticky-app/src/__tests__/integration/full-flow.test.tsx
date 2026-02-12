import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import WS from 'vitest-websocket-mock';

/**
 * Integration Test: Full Question-Answer Flow
 *
 * Tests the complete user journey:
 * 1. User types question in RichTextNode
 * 2. Clicks "Ask Claude" button
 * 3. WebSocket sends message to backend
 * 4. Backend processes with Claude
 * 5. Response comes back via WebSocket
 * 6. AgentNode is created with the response
 *
 * This test verifies all layers work together correctly.
 */

describe('Integration: Full Question-Answer Flow', () => {
  let wsServer: WS;

  beforeEach(() => {
    // Mock WebSocket server
    wsServer = new WS('ws://localhost:8080');
  });

  afterEach(() => {
    WS.clean();
  });

  test.todo('User asks question and receives Claude response', async () => {
    // This test will verify:
    // 1. RichTextNode renders with editor
    // 2. User types question
    // 3. "Ask Claude" button click sends WebSocket message
    // 4. Backend response creates AgentNode
    // 5. AgentNode displays question and response

    // Implementation will follow TDD workflow:
    // - Make test fail by implementing test logic
    // - Run manual test to verify expected behavior
    // - Ensure test passes once integration is confirmed working
  });

  test.todo('Handles WebSocket connection failure gracefully', async () => {
    // Verify error handling when WebSocket connection fails
  });

  test.todo('Handles Claude API error gracefully', async () => {
    // Verify error handling when Claude returns an error
  });

  test.todo('Shows loading state while waiting for response', async () => {
    // Verify loading indicator appears during request
  });

  test.todo('Allows user to ask follow-up questions', async () => {
    // Verify conversation can continue after first response
  });
});

/**
 * Manual Testing Checklist
 *
 * Before running automated tests, verify manually:
 *
 * □ Backend server running (npm run dev in server/)
 * □ Frontend dev server running (npm run dev in getsticky-app/)
 * □ Browser console shows WebSocket connected
 * □ Type question in RichTextNode
 * □ Click "Ask Claude" button
 * □ See loading indicator
 * □ See AgentNode appear with response
 * □ Verify response content is correct
 *
 * Once manual testing passes, implement automated test above.
 */
