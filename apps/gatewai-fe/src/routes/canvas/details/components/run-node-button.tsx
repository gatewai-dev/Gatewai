
import { memo, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ForwardIcon } from 'lucide-react';
import { useCanvasCtx } from '../ctx/canvas-ctx';
import type { AnyNode } from '../nodes/node-props';
import { useNodeTaskRunning, useTaskManagerCtx } from '../ctx/task-manager-ctx';
import { Spinner } from '@/components/ui/spinner';

export type RunNodeButtonProps = ButtonProps & {
  nodeProps: NodeProps<AnyNode>;
};

const RunNodeButton = memo(({nodeProps, ...buttonProps}: RunNodeButtonProps) => {
  const { runNodes } = useCanvasCtx();

  const isNodeRunning = useNodeTaskRunning(nodeProps.id)

  return (
    <Button {...buttonProps}
        disabled={isNodeRunning}
        onClick={() => runNodes([nodeProps.id])} size="sm">
        {!isNodeRunning && (<>
          <ForwardIcon />
          <span className='text-xs'>Run Node</span>
        </>)}
        {isNodeRunning && (<>
          <Spinner className='size-3' /> Running...
        </>)}
    </Button>
  );
});

export { RunNodeButton }
