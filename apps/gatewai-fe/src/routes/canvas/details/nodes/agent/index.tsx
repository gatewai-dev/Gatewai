
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  LLMResult,
} from '@gatewai/types';
import type { LLMNode } from '../node-props';
import { BaseNode } from '../base';
import { RunNodeButton } from '../../components/run-node-button';
import { useNodeResult } from '../../processor/processor-ctx';

const AgentNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const { result } = useNodeResult<LLMResult>(props.id);

  return (
    <BaseNode {...props}>
        <div className='justify-between'>
            <AddCustomHandleButton type="INPUT" />
            <AddCustomHandleButton type="OUTPUT" />
        </div>
        <div className='flex flex-col gap-2 items-end nowheel'>
            <RunNodeButton nodeProps={props} />
        </div>
    </BaseNode>
  );
});

export { AgentNodeComponent };