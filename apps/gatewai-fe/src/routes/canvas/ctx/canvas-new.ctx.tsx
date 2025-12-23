import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { useNavigate } from 'react-router';
import { rpcClient } from '@/rpc/client';
import type { CreateCanvasRPC } from '@/rpc/types';

const createCanvas = async (): Promise<CreateCanvasRPC> => {
  // Replace with your actual API endpoint
  const response = await rpcClient.api.v1.canvas.$post()
  if (!response.ok) {
    throw new Error('Network response was not ok');
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
  const nav = useNavigate();

  const { mutate, isPending } = useMutation<CreateCanvasRPC, Error, string>({
    mutationFn: createCanvas,
    onSuccess: (canvas: CreateCanvasRPC) => {
      queryClient.invalidateQueries({ queryKey: ['canvasList'] });
      nav(`/canvas/${canvas.id}`);
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