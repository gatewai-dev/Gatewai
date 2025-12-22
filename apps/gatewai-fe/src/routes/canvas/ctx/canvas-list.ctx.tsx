import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type {Canvas } from '@gatewai/types';
import { rpcClient } from '@/rpc/client';
import type { InferResponseType } from 'hono';

interface CanvasContextType {
  canvasList: CanvasList | undefined;
  isError: boolean;
  isLoading: boolean;
  searchQuery: string | undefined;
  setSearchQuery: Dispatch<SetStateAction<string | undefined>>
}

const CanvasListContext = createContext<CanvasContextType | undefined>(undefined);

export type CanvasList = InferResponseType<typeof rpcClient.api.v1.canvas.$get>

const fetchCanvasList = async (searchQuery?: string): Promise<CanvasList> => {
  // Replace with your actual API endpoint
  const response = await rpcClient.api.v1.canvas.$get({
    query: {
      q: searchQuery
    }
  })
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data: Promise<CanvasList> = response.json();

  return data;
};

const CanvasListProvider = ({
  children,
}: PropsWithChildren) => {

  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);

  const {
    data: canvasList,
    isLoading,
    isError,
  } = useQuery<Canvas[]>({
    queryKey: ['canvasList'],
    queryFn: () => fetchCanvasList(searchQuery),
  });

  const value = {
    canvasList,
    isError,
    isLoading,
    searchQuery,
    setSearchQuery
  };

  return <CanvasListContext.Provider value={value}>{children}</CanvasListContext.Provider>;
};

export function useCanvasListCtx() {
  const ctx = useContext(CanvasListContext);
  if (!ctx) {
    throw new Error('useCanvasListCtx should used inside CanvasListProvider');
  }
  return ctx;
}

export { CanvasListContext, CanvasListProvider }