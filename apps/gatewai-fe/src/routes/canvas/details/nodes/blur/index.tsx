
import { memo, useEffect, useMemo, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type NodeResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { makeSelectAllHandles, makeSelectHandleByNodeId } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';

const ImagePlaceholder = () => {
    return (<div className="w-full media-container h-[280px]"></div>);
}

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const allNodes = useAppSelector(makeSelectAllNodes);
    const allHandles = useAppSelector(makeSelectAllHandles);
    const node = useAppSelector(makeSelectNodeById(props.id));
    const handles = useAppSelector(makeSelectHandleByNodeId(props.id));
    const allEdges = useAppSelector(makeSelectAllEdges);
    const context = useMemo(() => {
        if (!node) {
            return null;
        }
        // Blur node has single input handle
        const targetHandle = handles[0];
        const edge = allEdges.find(f => f.target === node.id && f.targetHandleId === targetHandle.id);
        if (!edge) {
            return null;
        }
        const sourceHandle = allHandles.find(f => f.id === edge.sourceHandleId);
        if (!sourceHandle) {
            return null;
        }
        const imageSourceNode = allNodes.find(f=> f.id === edge.source);

        const nodeResult = imageSourceNode?.result as unknown as NodeResult;
        const output = nodeResult.outputs[nodeResult.selectedOutputIndex];
        const sourceOutput = output.items.find(f => f.outputHandleId === sourceHandle.id);

        return {imageSourceNode, sourceHandle, edge, sourceOutput};
    }, [node, handles, allEdges, allHandles, allNodes])

    const showResult = context?.sourceOutput != null;

    useEffect(() => {
        const canvas = canvasRef.current
        if (showResult && canvas) {
            const canvasCtx = canvas.getContext('2d')
            if (!canvasCtx) {
                console.error('Canvas is missing')
                return;
            }
            const img = new Image(canvas.width, canvas.height);
            canvasCtx.drawImage(img ,0, 0)
        }
    }, [context?.sourceOutput?.data, showResult])

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        {!showResult && <ImagePlaceholder />}
        {showResult && (<canvas className='w-full' ref={canvasRef}></canvas>)}
      </div>
    </BaseNode>
  );
});
BlurNodeComponent.displayName = 'GPTIMage1Node';

export { BlurNodeComponent }
