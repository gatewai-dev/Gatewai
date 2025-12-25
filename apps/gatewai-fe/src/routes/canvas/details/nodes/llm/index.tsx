
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
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));
  const result = node?.result as unknown as LLMResult;

  const textResult = useMemo(() => {
    return result?.outputs?.[result.selectedOutputIndex]?.items?.[0]?.data ?? null;
  }, [result?.outputs, result.selectedOutputIndex])


  const { runNodes } = useCanvasCtx();

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {textResult && (
          <div className='text-xs bg-input p-2 max-h-[350px] min-h-[200px] overflow-auto w-full'>
            <Markdown remarkPlugins={[remarkGfm]}>{textResult}</Markdown>
          </div>
        )
        }
        {!textResult && (
          <div className='min-h-[200px] w-full bg-input max-h-full p-2'>
            <p className='text-xs text-gray-500'>LLM result will display here.</p>
          </div>
        )}
        <Button onClick={() => runNodes([props.data.id])}  size="xs"><PlayIcon />
        <span className='text-xs'>Run Node</span></Button>
      </div>
    </BaseNode>
  );
});
LlmNodeComponent.displayName = 'LLMNode';

export { LlmNodeComponent };