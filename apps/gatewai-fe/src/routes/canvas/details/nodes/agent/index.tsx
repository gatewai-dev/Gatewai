
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  LLMResult,
} from '@gatewai/types';
import type { LLMNode } from '../node-props';
import { BaseNode } from '../base';
import { RunNodeButton } from '../../components/run-node-button';
import { useNodeResult } from '../../processor/processor-ctx';
import { AddCustomHandleButton } from './add-custom-handle';
import { Separator } from '@/components/ui/separator';
import { useAppSelector } from '@/store';
import { makeSelectHandlesByNodeId } from '@/store/handles';

const AgentNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const { result } = useNodeResult<LLMResult>(props.id);
  const handles = useAppSelector(makeSelectHandlesByNodeId(props.id));
  const numOutputHandles = handles.filter(h => h.type === 'Output').length;
  const numInputHandles = handles.filter(h => h.type === 'Input').length;

  const maxHandleNum = Math.max(numInputHandles, numOutputHandles);

  return (
    <BaseNode {...props}>
        <div className='justify-between flex' style={{
          minHeight: (30 * maxHandleNum),
        }}>
            <AddCustomHandleButton nodeProps={props} type="Input" />
            <Separator orientation='vertical' className='mx-2' />
            <AddCustomHandleButton nodeProps={props} type="Output" />
        </div>
        <div className='flex flex-col gap-2 items-end nowheel'>
            <RunNodeButton nodeProps={props} />
        </div>
    </BaseNode>
  );
});

export { AgentNodeComponent };