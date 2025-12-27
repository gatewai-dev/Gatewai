
import { memo, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  LLMResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import type { LLMNode } from '../node-props';
import { BaseNode } from '../base';
import { MarkdownRenderer } from '../../components/markdown-renderer';
import { RunNodeButton } from '../../components/run-node-button';
import { useNodeResult } from '../../processor/processor-ctx';

const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {

  const { result, error } = useNodeResult<LLMResult>(props.id);
  const llmTextContent = useMemo(() => {
    if (!result || !result.outputs || result?.outputs?.length === 0) return null;
    const selectedGeneration = result.outputs[result.selectedOutputIndex || 0];
    if (typeof selectedGeneration.items[0].data === 'string') {
      return selectedGeneration.items[0].data;
    }
    return null;
  }, [result]);

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {llmTextContent && <MarkdownRenderer markdown={llmTextContent} />}
        {!llmTextContent && (
          <div className='min-h-[200px] w-full bg-input max-h-full p-2'>
            <p className='text-xs text-gray-500'>LLM result will display here.</p>
          </div>
        )}
        <RunNodeButton nodeProps={props} />
      </div>
    </BaseNode>
  );
});
LlmNodeComponent.displayName = 'LLMNode';

export { LlmNodeComponent };