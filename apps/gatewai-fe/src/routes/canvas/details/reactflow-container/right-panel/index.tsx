
import { memo } from 'react';
import { NodeConfigPanel } from './node-config';

const RightPanel = memo(() => {
  return (
    <div className="border-0 bg-background px-2 py-1 rounded-md shadow-md">
        <NodeConfigPanel />
    </div>
  );
})

export { RightPanel };