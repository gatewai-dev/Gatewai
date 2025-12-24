
import { memo, type ReactNode } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  FileResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { FileNode } from '../node-props';
import { GridBackground } from '../misc/grid-background';



const hasResult = (nodeProps: NodeProps<FileNode>) => {
    const outputs = nodeProps.data?.result?.outputs;
    const hasOutputs = outputs && outputs.length ;
    if (hasOutputs) {
        const hasItems = outputs[0].items && outputs[0].items.length > 0;
        return hasItems;
    }

    return false;
}

const FileNodeComponent = memo((props: NodeProps<FileNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as FileResult;
  const showResult = hasResult(props);

  return (
    <BaseNode {...props}>
        <div className='flex flex-col gap-2 items-end'>
            {showResult && <MediaContent node={props} result={result} />}
            {!showResult && <GridBackground />}
        </div>
    </BaseNode>
  );
});
FileNodeComponent.displayName = 'GPTIMage1Node';

export { FileNodeComponent }
