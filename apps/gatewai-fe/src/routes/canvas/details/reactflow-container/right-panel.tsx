import { useSelectedEntitiesCtx } from '../ctx/selected-entity-ctx';
import { memo } from 'react';

const RightPanel = memo(() => {
  const { selectedEdgeIDs, selectedNodeIDs } = useSelectedEntitiesCtx();
  console.log({selectedEdgeIDs, selectedNodeIDs})
  return (
    <div className="border-0 bg-background px-2 py-1 rounded-md shadow-md">
      {JSON.stringify({selectedNodeIDs})}
    </div>
  );
})

export { RightPanel };