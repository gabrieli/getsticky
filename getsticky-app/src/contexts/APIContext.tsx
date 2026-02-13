import { createContext, useContext, type ReactNode } from 'react';
import { getAPI, type GetStickyAPI } from '../lib/api';

const APIContext = createContext<GetStickyAPI | null>(null);

export function APIProvider({ boardId, children }: { boardId?: string; children: ReactNode }) {
  const api = getAPI(undefined, boardId);

  return <APIContext.Provider value={api}>{children}</APIContext.Provider>;
}

export function useAPI(): GetStickyAPI {
  const api = useContext(APIContext);
  if (!api) {
    throw new Error('useAPI must be used within APIProvider');
  }
  return api;
}
