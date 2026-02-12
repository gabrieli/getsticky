/**
 * React Hook for WebSocket Connection
 *
 * Provides React-friendly interface to WebSocket connection with:
 * - Connection status
 * - Event subscriptions
 * - Automatic cleanup
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getAPI, type GetStickyAPI } from '../lib/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  url?: string;
}

interface UseWebSocketReturn {
  api: GetStickyAPI;
  status: ConnectionStatus;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  on: (event: string, handler: (data: any) => void) => () => void;
}

/**
 * Hook to manage WebSocket connection
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true, url } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const apiRef = useRef<GetStickyAPI | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // Get or create API instance
  if (!apiRef.current) {
    apiRef.current = getAPI(url);
  }

  const api = apiRef.current;

  // Connect function
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      await api.connect();
      setStatus('connected');
    } catch (error) {
      console.error('[useWebSocket] Connection failed:', error);
      setStatus('error');
      throw error;
    }
  }, [api]);

  // Disconnect function
  const disconnect = useCallback(() => {
    api.disconnect();
    setStatus('disconnected');
  }, [api]);

  // Subscribe to event
  const on = useCallback((event: string, handler: (data: any) => void) => {
    return api.on(event, handler);
  }, [api]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Set up connection state listeners
    const unsubConnected = api.on('connected', () => {
      setStatus('connected');
    });

    const unsubDisconnected = api.on('disconnected', () => {
      setStatus('disconnected');
    });

    const unsubError = api.on('error', () => {
      setStatus('error');
    });

    unsubscribersRef.current.push(unsubConnected, unsubDisconnected, unsubError);

    // Cleanup on unmount
    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, [autoConnect, connect, api]);

  return {
    api,
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
    on,
  };
}

/**
 * Hook to subscribe to specific WebSocket event
 */
export function useWebSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
): void {
  const api = getAPI();

  useEffect(() => {
    const unsubscribe = api.on(event, handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * Hook to get connection status
 */
export function useConnectionStatus(): {
  status: ConnectionStatus;
  isConnected: boolean;
} {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const api = getAPI();

  useEffect(() => {
    // Check initial status
    setStatus(api.isConnected() ? 'connected' : 'disconnected');

    // Subscribe to status changes
    const unsubConnected = api.on('connected', () => setStatus('connected'));
    const unsubDisconnected = api.on('disconnected', () => setStatus('disconnected'));
    const unsubError = api.on('error', () => setStatus('error'));

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubError();
    };
  }, [api]);

  return {
    status,
    isConnected: status === 'connected',
  };
}
