import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Canvas } from '@gatewai/types';

const createCanvas = async (name: string): Promise<Canvas> => {
  const response = await fetch(`/api/v1/canvas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to create canvas');
  }
  return response.json();
};

interface CanvasCreationContextType {
  createCanvas: (name: string) => void;
  isCreating: boolean;
}

const CanvasCreationContext = createContext<CanvasCreationContextType | undefined>(undefined);

const CanvasCreationProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation<Canvas, Error, string>({
    mutationFn: createCanvas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvasList'] });
    },
  });

  const value = {
    createCanvas: mutate,
    isCreating: isPending,
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