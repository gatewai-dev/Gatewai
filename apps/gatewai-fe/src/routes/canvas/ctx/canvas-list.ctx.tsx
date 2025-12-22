import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import { rpcClient } from '@/rpc/client';
import type { CanvasListRPC } from '@/rpc/types';

interface CanvasContextType {
  canvasList: CanvasListRPC | undefined;
  isError: boolean;
  isLoading: boolean;
  searchQuery: string | undefined;
  setSearchQuery: Dispatch<SetStateAction<string | undefined>>
}

const CanvasListContext = createContext<CanvasContextType | undefined>(undefined);

const fetchCanvasList = async (searchQuery?: string): Promise<CanvasListRPC> => {
  // Replace with your actual API endpoint
  const response = await rpcClient.api.v1.canvas.$get({
    query: {
      q: searchQuery
    }
  })
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data: Promise<CanvasListRPC> = response.json();

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
  } = useQuery<CanvasListRPC>({
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