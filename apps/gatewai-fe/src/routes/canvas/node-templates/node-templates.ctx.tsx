import { createContext, useContext, type PropsWithChildren } from 'react';
import { useGetAllNodeTemplatesQuery } from '@/store/node-templates';
import type { NodeTemplateListRPC } from '@/rpc/types';



interface NodeTemplatesContextType {
  nodeTemplates: NodeTemplateListRPC | undefined;
  isLoading: boolean;
  isError: boolean;
}

const NodeTemplatesContext = createContext<NodeTemplatesContextType | undefined>(undefined);

const NodeTemplatesProvider = ({
  children,
}: PropsWithChildren) => {

  const { data, isLoading, isError } = useGetAllNodeTemplatesQuery(null);
  const value: NodeTemplatesContextType = {
    nodeTemplates: data ?? [],
    isLoading,
    isError,
  };

  return <NodeTemplatesContext.Provider value={value}>{children}</NodeTemplatesContext.Provider>;
};

export function useNodeTemplates() {
  const ctx = useContext(NodeTemplatesContext);
  if (!ctx) {
    throw new Error('useNodeTemplates should used inside NodeTemplatesProvider');
  }
  return ctx;
}

export { NodeTemplatesContext, NodeTemplatesProvider }