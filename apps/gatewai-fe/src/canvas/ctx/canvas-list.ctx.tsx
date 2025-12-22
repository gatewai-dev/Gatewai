import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type {Canvas } from '@gatewai/types';
import qs from 'query-string';

interface CanvasContextType {
  canvasList: Canvas[] | undefined;
  isError: boolean;
  isLoading: boolean;
  searchQuery: string | "";
  setSearchQuery: Dispatch<SetStateAction<string | undefined>>
}

const CanvasListContext = createContext<CanvasContextType | undefined>(undefined);

const fetchCanvasList = async (searchQuery?: string): Promise<Canvas[]> => {
  // Replace with your actual API endpoint
  let endpoint = `${import.meta.env.VITE_API_URL}/canvas`;
  if (searchQuery && searchQuery.trim() !== "") {
    const qStr = qs.stringify({q: searchQuery})
    endpoint += `?${qStr}`;
  }
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
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