
import { memo, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  BlurResult,
  ImagesResult,
  NodeResult,
  Output,
  OutputItem
} from '@gatewai/types';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { useCanvasCtx } from '../../ctx/canvas-ctx';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { BlurNode } from '../node-props';
import { makeSelectHandleByNodeId } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';

const ImagePlaceholder = () => {
    return (<div className="w-full media-container h-[280px]"></div>);
}

const hasResult = (nodeProps: NodeProps<BlurNode>) => {
    const outputs = nodeProps.data?.result?.outputs;
    const hasOutputs = outputs && outputs.length ;
    if (hasOutputs) {
        const hasItems = outputs[0].items && outputs[0].items.length;
        return hasItems;
    }

    return false;
}

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
    const allNodes = useAppSelector(makeSelectAllNodes);
    const node = useAppSelector(makeSelectNodeById(props.id));
    const handles = useAppSelector(makeSelectHandleByNodeId(props.id));
    const allEdges = useAppSelector(makeSelectAllEdges);
    const imageSourceNode = useMemo(() => {
        if (!node) {
            return null;
        }
        const edge = allEdges.find(f => f.target === node.id);
        if (!edge) {
            return null;
        }
        const sourceNode = allNodes.find(f => f.id === edge.source);

        return sourceNode;
    }, [node, allEdges, allNodes])
    const result = node?.result as unknown as NodeResult;
    let outputItem: OutputItem<"Image"> | null = useMemo(() => {
        if (Object.hasOwn(result, "selectedOutputIndex")) {
            const outputItem = result.outputs[result.selectedOutputIndex as unknown as number]
        } else {
            
        }
    }, [])
    const showResult = hasResult(props);

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {!showResult && <ImagePlaceholder />}
        <Button onClick={() => runNodes([props.data.id])} size="xs" >
          <PlayIcon />
          <span className='text-xs'>Run Node</span>
        </Button>
      </div>
    </BaseNode>
  );
});
BlurNodeComponent.displayName = 'GPTIMage1Node';

export { BlurNodeComponent }
