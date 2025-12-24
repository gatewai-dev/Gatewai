import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { CanvasListRPC } from '@/rpc/types';
import { useGetCanvasListQuery } from '@/store/canvas';

interface CanvasContextType {
  canvasList: CanvasListRPC | undefined;
  isError: boolean;
  isLoading: boolean;
  searchQuery: string | undefined;
  setSearchQuery: Dispatch<SetStateAction<string | undefined>>
}

const CanvasListContext = createContext<CanvasContextType | undefined>(undefined);

const CanvasListProvider = ({
  children,
}: PropsWithChildren) => {

  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const {data, isLoading, isError} = useGetCanvasListQuery({})

  const value = {
    canvasList: data,
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