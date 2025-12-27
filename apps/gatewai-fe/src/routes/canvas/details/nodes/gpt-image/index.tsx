
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  GPTImage1Result,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { GPTImage1Node } from '../node-props';
import { useHasOutputItems } from '@/routes/canvas/hooks';
import { RunNodeButton } from '../../components/run-node-button';

const ImagePlaceholder = () => {
    return (<div className="w-full media-container h-[280px]"></div>);
}

const GPTImage1NodeComponent = memo((props: NodeProps<GPTImage1Node>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as GPTImage1Result;
  const showResult = useHasOutputItems(node);

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {showResult && <MediaContent node={props} result={result} />}
        {!showResult && <ImagePlaceholder />}
        <RunNodeButton nodeProps={props}  />
      </div>
    </BaseNode>
  );
});
GPTImage1NodeComponent.displayName = 'GPTIMage1Node';

export { GPTImage1NodeComponent }
