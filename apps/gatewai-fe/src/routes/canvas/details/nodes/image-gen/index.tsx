
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  ImageGenResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { ImageGenNode } from '../node-props';
import { useHasOutputItems } from '@/routes/canvas/hooks';
import { RunNodeButton } from '../../components/run-node-button';
import { CreateHandleButton } from './create-handle-button';

const ImagePlaceholder = () => {
    return (<div className="w-full media-container h-[280px]"></div>);
}

const ImageGenNodeComponent = memo((props: NodeProps<ImageGenNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as ImageGenResult;
  const showResult = useHasOutputItems(node);

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {showResult && <MediaContent node={props} result={result} />}
        {!showResult && <ImagePlaceholder />}
        <div className='flex justify-between items-center w-full'>
          <CreateHandleButton nodeProps={props} />
          <RunNodeButton nodeProps={props}  />
        </div>
      </div>
    </BaseNode>
  );
});
ImageGenNodeComponent.displayName = 'ImageGenNode';

export { ImageGenNodeComponent }
