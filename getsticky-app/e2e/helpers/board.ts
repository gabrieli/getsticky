import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';

/**
 * Create a board via WebSocket.
 * Returns the board ID.
 */
export async function createBoard(name?: string, id?: string): Promise<string> {
  const boardId = id || `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const boardName = name || `Board ${boardId}`;

  await sendWsMessage(WS_URL, {
    type: 'create_board',
    data: { id: boardId, name: boardName },
  });

  return boardId;
}

/**
 * Delete a board via WebSocket.
 */
export async function deleteBoard(boardId: string): Promise<void> {
  await sendWsMessage(WS_URL, {
    type: 'delete_board',
    data: { id: boardId },
  });
}

/**
 * Send a single message to the WS server and wait for a response.
 */
function sendWsMessage(url: string, message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket message timed out'));
    }, 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      const parsed = JSON.parse(data.toString());
      // Skip the initial_state message, wait for the actual response
      if (parsed.type === 'success' && parsed.data?.type === 'initial_state') {
        return;
      }
      ws.close();
      resolve(parsed);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
