import { createContext, useContext, type PropsWithChildren } from 'react';
import { useCreateCanvasMutation } from '@/store/canvas';
interface CanvasCreationContextType {
  createCanvas: (name: string) => ReturnType<ReturnType<typeof useCreateCanvasMutation>[0]>;
  isCreating: boolean;
}

const CanvasCreationContext = createContext<CanvasCreationContextType | undefined>(undefined);

const CanvasCreationProvider = ({ children }: PropsWithChildren) => {
  const [mutate, {isLoading}] = useCreateCanvasMutation();

  const value = {
    createCanvas: mutate,
    isCreating: isLoading,
  };

  return <CanvasCreationContext.Provider value={value}>{children}</CanvasCreationContext.Provider>;
};

export function useCanvasCreationCtx() {
  const ctx = useContext(CanvasCreationContext);
  if (!ctx) {
    throw new Error('useCanvasCreationCtx must be used inside CanvasCreationProvider');
  }
  return ctx;
}

export { CanvasCreationContext, CanvasCreationProvider };