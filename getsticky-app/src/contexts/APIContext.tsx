import { createContext, useContext, type ReactNode } from 'react';
import { getAPI, type GetStickyAPI } from '../lib/api';

const APIContext = createContext<GetStickyAPI | null>(null);

export function APIProvider({ children }: { children: ReactNode }) {
  const api = getAPI();

  return <APIContext.Provider value={api}>{children}</APIContext.Provider>;
}

export function useAPI(): GetStickyAPI {
  const api = useContext(APIContext);
  if (!api) {
    throw new Error('useAPI must be used within APIProvider');
  }
  return api;
}
