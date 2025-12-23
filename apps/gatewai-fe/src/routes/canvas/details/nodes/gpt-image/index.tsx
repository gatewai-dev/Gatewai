
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  GPTImage1Result,
} from '@gatewai/types';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { useCanvasCtx } from '../../ctx/canvas-ctx';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { GPTImage1Node } from '../node-props';

const ImagePlaceholder = () => {
    return (<div className="w-full media-container h-[280px]"></div>);
}

const hasResult = (nodeProps: NodeProps<GPTImage1Node>) => {
    const outputs = nodeProps.data?.result?.outputs;
    const hasOutputs = outputs && outputs.length ;
    if (hasOutputs) {
        const hasItems = outputs[0].items && outputs[0].items.length;
        return hasItems;
    }

    return false;
}

const GPTImage1NodeComponent = memo((props: NodeProps<GPTImage1Node>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as GPTImage1Result;
  const { runNodes } = useCanvasCtx();
  const showResult = hasResult(props);

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {showResult && <MediaContent node={props} result={result} />}
        {!showResult && <ImagePlaceholder />}
        <Button onClick={() => runNodes([props.data.id])} size="xs" >
          <PlayIcon />
          <span className='text-xs'>Run Node</span>
        </Button>
      </div>
    </BaseNode>
  );
});
GPTImage1NodeComponent.displayName = 'GPTIMage1Node';

export { GPTImage1NodeComponent }
