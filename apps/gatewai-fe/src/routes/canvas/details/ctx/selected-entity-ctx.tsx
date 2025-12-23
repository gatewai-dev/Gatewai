import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Edge, Node } from '@gatewai/types';

interface SelectedEntitiesContextType {
  selectedNodeIDs: Node["id"][],
  setSelectedNodeIDs: Dispatch<SetStateAction<Node["id"][]>>
  selectedEdgeIDs: Edge["id"][],
  setSelectedEdgeIDs: Dispatch<SetStateAction<Edge["id"][]>>
}

const SelectedEntitiesContext = createContext<SelectedEntitiesContextType | undefined>(undefined);

const SelectedEntitiesProvider = ({
  children,
}: PropsWithChildren) => {

  const [selectedNodeIDs, setSelectedNodeIDs] = useState<Node["id"][]>([]);
  const [selectedEdgeIDs, setSelectedEdgeIDs] = useState<Edge["id"][]>([]);

  const value: SelectedEntitiesContextType = {
    selectedEdgeIDs,
    selectedNodeIDs,
    setSelectedEdgeIDs,
    setSelectedNodeIDs,
  }

  return <SelectedEntitiesContext.Provider value={value}>{children}</SelectedEntitiesContext.Provider>;
};

export function useSelectedEntitiesCtx() {
  const ctx = useContext(SelectedEntitiesContext);
  if (!ctx) {
    throw new Error('useSelectedEntitiesCtx should used inside SelectedEntitiesProvider');
  }
  return ctx;
}

export { SelectedEntitiesContext, SelectedEntitiesProvider }