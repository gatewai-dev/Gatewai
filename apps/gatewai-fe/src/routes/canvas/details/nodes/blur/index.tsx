import { memo, useEffect, useMemo, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { type BlurNodeConfig, type FileData } from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { makeSelectAllHandles } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import { BlurValueSlider } from './blur-slider';
import { browserNodeProcessors } from '../../node-processors';
import { useNodeContext } from '../hooks/use-node-ctx';
import { useNodeInputValuesResolver } from '../hooks/use-handle-value-resolver';

const ImagePlaceholder = () => (
  <div className="w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700">
    <span className="text-gray-400 text-sm">No image connected</span>
  </div>
);

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);
  
  // This canvas is used strictly for display (2D Context)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const config: BlurNodeConfig = (node?.config ?? props.data.config) as BlurNodeConfig;
  const resolverArgs = useMemo(() => ({ nodeId: props.id }), [props.id]);

  const context = useNodeContext(resolverArgs);
  const nodeInputContext = useNodeInputValuesResolver(resolverArgs);

  // Helper to determine if we should use local cached data or fetch fresh
  const shouldUseLocalImageData = useMemo(() => {
    if (!context?.inputHandles[0].id) return false;
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
    const cachedValue = imageHandleCtx?.cachedResultValue;
    return !!(cachedValue && cachedValue.data);
  }, [context?.inputHandles, nodeInputContext]);

  const inputImageResult = useMemo(() => {
    if (!context?.inputHandles[0].id) return null;
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
    
    if (imageHandleCtx?.cachedResultValue?.data) {
      return imageHandleCtx.cachedResultValue;
    }
    
    if (imageHandleCtx?.resultValue?.data) {
      return imageHandleCtx.resultValue;
    }
    return null;
  }, [context?.inputHandles, nodeInputContext]);

  const inputImageUrl = useMemo(() => {
    if (inputImageResult) {
      const fileData = inputImageResult.data as FileData;
      if (fileData?.entity?.id) {
        return fileData.entity.signedUrl;
      }
      return fileData.dataUrl;
    }
    return null;
  }, [inputImageResult]);

  // Compute Key Strategy
  const computeKey = useMemo(() => {
    if (!context?.inputHandles[0].id || !inputImageUrl) return null;
    
    let key = '';
    // If upstream changed
    if (shouldUseLocalImageData) {
      const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
      key += imageHandleCtx?.cachedResult?.hash ?? '';
    } else {
      key += inputImageUrl;
    }
    // If local config changed
    key += JSON.stringify(config, Object.keys(config).sort());
    return key;
  }, [context?.inputHandles, inputImageUrl, config, shouldUseLocalImageData, nodeInputContext]);

  // Trigger Processor
  useEffect(() => {
    if (!inputImageUrl || !computeKey || !node || !context?.inputHandles[0].id || !canvasRef.current) {
      return;
    }

    const compute = async () => {
      const processor = browserNodeProcessors['Blur'];
      if (!processor) {
        console.error('Blur processor not found');
        return;
      }
      
      // We pass the canvasRef. The processor will generate the image off-screen (via Pixi)
      // and draw the final result onto this canvas using standard 2D context.
      await processor({ 
        node, 
        data: { nodes: allNodes, edges: allEdges, handles: allHandles }, 
        extraArgs: { 
          nodeInputContextData: nodeInputContext[context?.inputHandles[0].id], 
          canvas: canvasRef.current 
        } 
      });
    };

    compute();
  }, [allEdges, allHandles, allNodes, computeKey, context?.inputHandles, inputImageUrl, node, nodeInputContext]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!inputImageUrl ? (
          <ImagePlaceholder />
        ) : (
          <div className="w-full overflow-hidden rounded bg-black/5 min-h-[100px]">
            <canvas ref={canvasRef} className="block w-full h-auto" />
          </div>
        )}
        
        {node && (
          <div className="flex gap-3 items-end p-1">
            <BlurValueSlider node={node} />
          </div>
        )}
      </div>
    </BaseNode>
  );
});

BlurNodeComponent.displayName = 'BlurNodeComponent';

export { BlurNodeComponent };