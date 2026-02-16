/**
 * WebSocket Client Manager for GetSticky
 *
 * Manages WebSocket connection to backend server with:
 * - Automatic reconnection
 * - Type-safe event handling
 * - Connection state tracking
 */

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type EventHandler = (data: any) => void;

interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected' || this.state === 'connecting') {
        resolve();
        return;
      }

      this.state = 'connecting';
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        console.log('[WebSocket] Connected to', this.config.url);
        this.emit('connected', {});
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit('error', { error });
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        this.state = 'disconnected';
        this.emit('disconnected', {});
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = 'disconnected';
  }

  /**
   * Send message to server
   * Backend expects: { type: 'event_name', data: {...}, id?: 'requestId' }
   */
  send(type: string, data: any = {}, requestId?: string): void {
    if (this.state !== 'connected' || !this.ws) {
      console.warn('[WebSocket] Cannot send - not connected');
      return;
    }

    const message: any = { type, data };
    if (requestId) {
      message.id = requestId;
    }

    console.log('[WebSocket] SENDING:', JSON.stringify(message, null, 2));
    this.ws.send(JSON.stringify(message));
    console.log('[WebSocket] Message sent successfully');
  }

  /**
   * Subscribe to event
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      this.listeners.delete(event);
      return;
    }

    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Handle incoming message
   * Backend sends: { type: 'event_name', ...data }
   */
  private handleMessage(message: { type: string; [key: string]: any }): void {
    const { type, ...data } = message;
    this.emit(type, data);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Error in handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('max_reconnect_attempts', {});
      return;
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    console.log(
      `[WebSocket] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, this.config.reconnectInterval);
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;
let wsClientBoardId: string | undefined;

/**
 * Derive WebSocket URL from environment or page origin.
 * In dev mode, VITE_WS_URL points to the separate WS server.
 * In production (served from the same server), derive from window.location.
 */
function getDefaultWsUrl(): string {
  // Check for Vite env variable first (dev mode)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // Derive from page origin (production: frontend served from same port)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'ws://localhost:2529';
}

/**
 * Get or create WebSocket client instance.
 * If boardId is explicitly provided and differs, recreates the connection.
 * If called without boardId, returns the existing instance.
 */
export function getWebSocketClient(url?: string, boardId?: string): WebSocketClient {
  if (wsClient) {
    if (boardId !== undefined && wsClientBoardId !== boardId) {
      wsClient.disconnect();
      wsClient = null;
    } else {
      return wsClient;
    }
  }
  wsClientBoardId = boardId;
  const baseUrl = url || getDefaultWsUrl();
  const fullUrl = boardId ? `${baseUrl}?board=${boardId}` : baseUrl;
  wsClient = new WebSocketClient({ url: fullUrl });
  return wsClient;
}

/**
 * Disconnect and destroy WebSocket client
 */
export function destroyWebSocketClient(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}

/**
 * Derive the HTTP API base URL.
 * In dev mode, use VITE_API_URL. In production, derive from page origin.
 */
export function getApiBaseUrl(): string {
  // Check for Vite env variable first (dev mode)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Derive from page origin (production: frontend served from same port)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:2529';
}
