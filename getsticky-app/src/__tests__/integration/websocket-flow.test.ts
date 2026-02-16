import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

/**
 * Integration Test: WebSocket Communication Flow
 *
 * Tests the complete WebSocket communication between frontend and backend:
 * 1. WebSocket connection establishment
 * 2. Send ask_claude event with question
 * 3. Receive claude_response with AgentNode data
 * 4. Verify node structure and content
 * 5. Verify edge creation
 *
 * REQUIREMENTS:
 * - Backend server running on ws://localhost:8080
 * - ANTHROPIC_API_KEY configured in backend
 * - This is an integration test, not a unit test
 *
 * RUN MANUALLY:
 * npm test -- src/__tests__/integration/websocket-flow.test.ts
 */

const WS_URL = 'ws://localhost:8080';
const CONNECTION_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 30000; // Claude responses can take time

// Helper: Wait for WebSocket connection
function waitForConnection(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`WebSocket connection timeout after ${CONNECTION_TIMEOUT}ms`));
    }, CONNECTION_TIMEOUT);

    ws.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.addEventListener('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket connection error: ${error}`));
    });
  });
}

// Helper: Wait for specific message type
function waitForMessage(
  ws: WebSocket,
  messageType: string,
  timeout: number = RESPONSE_TIMEOUT
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${messageType}`));
    }, timeout);

    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === messageType) {
          clearTimeout(timeoutId);
          ws.removeEventListener('message', handler);
          resolve(message);
        }
      } catch (error) {
        // Ignore parse errors, keep waiting
      }
    };

    ws.addEventListener('message', handler);
    ws.addEventListener('error', (error) => {
      clearTimeout(timeoutId);
      ws.removeEventListener('message', handler);
      reject(new Error(`WebSocket error: ${error}`));
    });
    ws.addEventListener('close', () => {
      clearTimeout(timeoutId);
      ws.removeEventListener('message', handler);
      reject(new Error('WebSocket closed while waiting for message'));
    });
  });
}

// Helper: Send message and wait for response
async function sendAndWaitFor(
  ws: WebSocket,
  sendData: any,
  responseType: string,
  timeout?: number
): Promise<any> {
  const responsePromise = waitForMessage(ws, responseType, timeout);
  ws.send(JSON.stringify(sendData));
  return responsePromise;
}

describe('GetSticky Integration: WebSocket Flow', () => {
  describe('Full Conversation Flow', () => {
    test('should complete ask_claude flow end-to-end', async () => {
      // 1. Connect to WebSocket
      const ws = new WebSocket(WS_URL);
      await waitForConnection(ws);

      // 2. Send ask_claude event
      const question = 'What is React Flow?';
      const nodePosition = { x: 100, y: 100 };

      const response = await sendAndWaitFor(
        ws,
        {
          type: 'ask_claude',
          data: {
            question,
            node_position: nodePosition,
          },
        },
        'claude_response'
      );

      // 3. Verify response structure
      expect(response.type).toBe('claude_response');
      expect(response.data).toBeDefined();
      expect(response.data.node).toBeDefined();

      // 4. Verify AgentNode data
      const node = response.data.node;
      expect(node.id).toBeDefined();
      expect(node.type).toBe('agent');
      expect(node.position).toEqual(nodePosition);
      expect(node.data).toBeDefined();
      expect(node.data.question).toBe(question);
      expect(node.data.response).toBeDefined();
      expect(node.data.response.length).toBeGreaterThan(0);
      expect(node.data.timestamp).toBeDefined();

      // 5. Wait for edge_created event
      const edgeEvent = await waitForMessage(ws, 'edge_created', 5000);
      expect(edgeEvent.data.edge).toBeDefined();
      expect(edgeEvent.data.edge.target).toBe(node.id);

      // Clean up
      ws.close();
    }, 35000); // Longer timeout for full flow with Claude API

    test('should handle connection and disconnection', async () => {
      // 1. Connect
      const ws = new WebSocket(WS_URL);
      await waitForConnection(ws);

      // 2. Verify connection is open
      expect(ws.readyState).toBe(WebSocket.OPEN);

      // 3. Close connection
      ws.close();

      // 4. Wait for close event
      await new Promise<void>((resolve) => {
        ws.addEventListener('close', () => resolve());
      });

      // 5. Verify connection is closed
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid message format gracefully', async () => {
      const ws = new WebSocket(WS_URL);
      await waitForConnection(ws);

      // Send invalid JSON
      ws.send('invalid json{');

      // Server should handle gracefully and not crash
      // Wait a bit to ensure no error response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    test('should handle missing required fields', async () => {
      const ws = new WebSocket(WS_URL);
      await waitForConnection(ws);

      // Send ask_claude without required fields
      ws.send(
        JSON.stringify({
          type: 'ask_claude',
          data: {}, // Missing question and node_position
        })
      );

      // Should receive error response
      const errorResponse = await waitForMessage(ws, 'error', 5000);
      expect(errorResponse.data.message).toBeDefined();

      ws.close();
    });
  });

  describe('Multiple Questions', () => {
    test('should handle multiple sequential questions', async () => {
      const ws = new WebSocket(WS_URL);
      await waitForConnection(ws);

      // Ask first question
      const response1 = await sendAndWaitFor(
        ws,
        {
          type: 'ask_claude',
          data: {
            question: 'What is TypeScript?',
            node_position: { x: 100, y: 100 },
          },
        },
        'claude_response'
      );

      expect(response1.data.node.data.question).toBe('What is TypeScript?');

      // Ask second question
      const response2 = await sendAndWaitFor(
        ws,
        {
          type: 'ask_claude',
          data: {
            question: 'What is Vite?',
            node_position: { x: 200, y: 200 },
          },
        },
        'claude_response'
      );

      expect(response2.data.node.data.question).toBe('What is Vite?');

      // Verify different node IDs
      expect(response1.data.node.id).not.toBe(response2.data.node.id);

      ws.close();
    }, 60000); // Extra time for two Claude API calls
  });
});

/**
 * Running This Test
 *
 * 1. Start the backend server:
 *    cd server && npm run dev
 *
 * 2. Ensure ANTHROPIC_API_KEY is set in backend environment
 *
 * 3. Run this specific test:
 *    cd getsticky-app
 *    npm test -- src/__tests__/integration/websocket-flow.test.ts
 *
 * Note: This test makes real API calls to Claude and requires:
 * - Backend server running
 * - Valid ANTHROPIC_API_KEY
 * - Network connection
 *
 * DO NOT run this in CI without proper API key management.
 */
