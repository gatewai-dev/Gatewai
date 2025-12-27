import { createContext, useCallback, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Node as ClientNode, Edge as ClientEdge } from '@xyflow/react';
import type { NodeEntityType } from '@/store/nodes';
import type { EdgeEntityType } from '@/store/edges';

interface SelectedEntitiesContextType {
  selectedNodeIDs: NodeEntityType["id"][],
  setSelectedNodeIDs: Dispatch<SetStateAction<NodeEntityType["id"][]>>
  selectedEdgeIDs: EdgeEntityType["id"][],
  setSelectedEdgeIDs: Dispatch<SetStateAction<EdgeEntityType["id"][]>>
  onSelectionChange: ({ nodes, edges }: {
    nodes: ClientNode[];
    edges: ClientEdge[];
  }) => void
}

const SelectedEntitiesContext = createContext<SelectedEntitiesContextType | undefined>(undefined);

const SelectedEntitiesProvider = ({
  children,
}: PropsWithChildren) => {

  const [selectedNodeIDs, setSelectedNodeIDs] = useState<NodeEntityType["id"][]>([]);
  const [selectedEdgeIDs, setSelectedEdgeIDs] = useState<EdgeEntityType["id"][]>([]);

  const onSelectionChange = useCallback(({ nodes, edges }: {nodes: ClientNode[], edges: ClientEdge[]}) => {
    setSelectedNodeIDs(nodes.map((node) => node.id));
    setSelectedEdgeIDs(edges.map((edge) => edge.id));
  }, []);


  const value: SelectedEntitiesContextType = {
    selectedEdgeIDs,
    selectedNodeIDs,
    setSelectedEdgeIDs,
    setSelectedNodeIDs,
    onSelectionChange,
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