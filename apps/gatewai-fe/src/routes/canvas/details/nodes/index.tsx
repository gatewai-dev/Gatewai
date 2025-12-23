
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './base';
import type {
  GPTImage1Result,
} from '@gatewai/types';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useCanvasCtx } from '../ctx/canvas-ctx';
import { MediaContent } from './media-content';
import type { GPTImage1Node } from './node-props';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';

const GPTImage1NodeComponent = memo((props: NodeProps<GPTImage1Node>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as GPTImage1Result;
  const { runNodes } = useCanvasCtx();
  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {result && <MediaContent node={props} result={result} />}
        <Button onClick={() => runNodes([props.data.id])} size="xs" >
          <PlayIcon />
          <span className='text-xs'>Run Node</span>
        </Button>
      </div>
    </BaseNode>
  );
});
GPTImage1NodeComponent.displayName = 'GPTIMage1Node';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Text: TextNodeComponent,
  GPTImage1: GPTImage1NodeComponent
};

// Export components
export {
  nodeTypes,
  LlmNodeComponent,
  TextNodeComponent,
  GPTImage1NodeComponent,
};