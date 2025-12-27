
import { memo, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  LLMResult,
} from '@gatewai/types';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import type { LLMNode } from '../node-props';
import { useCanvasCtx } from '../../ctx/canvas-ctx';
import { BaseNode } from '../base';
import { useTaskManagerCtx } from '../../ctx/task-manager-ctx';
import { Spinner } from '@/components/ui/spinner';
import { MarkdownRenderer } from '../../components/markdown-renderer';

const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const { nodeTaskStatus } = useTaskManagerCtx();
  const node = useAppSelector(makeSelectNodeById(props.id));
  const result = node?.result as unknown as LLMResult;

  const textResult = useMemo(() => {
    return result?.outputs?.[result.selectedOutputIndex]?.items?.[0]?.data ?? null;
  }, [result?.outputs, result?.selectedOutputIndex])

  const { runNodes } = useCanvasCtx();

  const isNodeRunning = useMemo(() => {
    if (!node) {
      return false;
    }
    return Object.hasOwn(nodeTaskStatus, node.id)
  }, [node, nodeTaskStatus])

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {textResult && <MarkdownRenderer markdown={textResult} />}
        {!textResult && (
          <div className='min-h-[200px] w-full bg-input max-h-full p-2'>
            <p className='text-xs text-gray-500'>LLM result will display here.</p>
          </div>
        )}
        <Button
          className='w-24'
          variant="outline"
          disabled={isNodeRunning} 
          onClick={() => runNodes([props.data.id])} size="sm">
          {!isNodeRunning && (<>
            <PlayIcon />
            <span className='text-xs'>Run Node</span>
          </>)}
          {isNodeRunning && (<>
            <Spinner className='size-3' />
          </>)}
        </Button>
      </div>
    </BaseNode>
  );
});
LlmNodeComponent.displayName = 'LLMNode';

export { LlmNodeComponent };