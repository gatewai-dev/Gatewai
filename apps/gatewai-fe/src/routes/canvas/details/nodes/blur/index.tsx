import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type BlurNodeConfig,
  type NodeResult,
  type FileData,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { makeSelectAllHandles, makeSelectHandleByNodeId } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import type { FileAsset } from '@gatewai/db';
import { BlurTypeSelector } from './type-selector';
import { BlurValueSlider } from './blur-slider';
import { browserNodeProcessors } from '../node-processors';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const handles = useAppSelector(makeSelectHandleByNodeId(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);
  
  const config: BlurNodeConfig = (node?.config ?? props.data.config) as BlurNodeConfig;
  
  const context = useMemo(() => {
    if (!node || !handles.length) {
      return null;
    }
    
    const targetHandle = handles.find(h => h.type === 'Input'); // Matching the processor's assumption
    if (!targetHandle) {
      return null;
    }
    
    const edge = allEdges.find(
      e => e.target === node.id && e.targetHandleId === targetHandle.id
    );
    
    if (!edge) {
      return null;
    }
    
    const sourceHandle = allHandles.find(h => h.id === edge.sourceHandleId);
    if (!sourceHandle) {
      return null;
    }
    
    const imageSourceNode = allNodes.find(n => n.id === edge.source);
    if (!imageSourceNode) {
      return null;
    }
    
    const nodeResult = imageSourceNode.result as unknown as NodeResult;
    if (!nodeResult?.outputs) {
      return null;
    }
    
    const output = nodeResult.outputs[nodeResult.selectedOutputIndex];
    const sourceOutput = output?.items.find(
      item => item.outputHandleId === sourceHandle.id
    );
    
    return { imageSourceNode, sourceHandle, edge, sourceOutput };
  }, [node, handles, allEdges, allHandles, allNodes]);
  
  const showResult = context?.sourceOutput != null;
  const inputImageUrl = showResult ? (context!.sourceOutput!.data as FileData).dataUrl || (context!.sourceOutput!.data as FileData).entity?.signedUrl : null;

  // Compute a key to detect changes in input or config
  const computeKey = useMemo(() => {
    if (!inputImageUrl) return null;
    return inputImageUrl + JSON.stringify(config, Object.keys(config).sort());
  }, [inputImageUrl, config]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Compute the blur using the processor
  useEffect(() => {
    if (!showResult || !computeKey || !node) {
      setPreviewUrl(null);
      return;
    }

    const compute = async () => {
      const data = {
        nodes: allNodes,
        edges: allEdges,
        handles: allHandles,
      };
      const processor = browserNodeProcessors['Blur'];
      if (!processor) {
        console.error('Blur processor not found');
        return;
      }
      const res = await processor({ node, data });
      if (res.success && res.newResult) {
        const dataUrl = (res.newResult.outputs[0].items[0].data as FileData).dataUrl;
        if (dataUrl) {
          setPreviewUrl(dataUrl);
        }
      } else {
        console.error('Failed to process blur:', res.error);
      }
    };

    compute();
  }, [computeKey, showResult, node, allNodes, allEdges, allHandles]);

  // Draw the preview when previewUrl changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) {
      return;
    }

    if (!imgRef.current) {
      imgRef.current = new Image();
    }

    const img = imgRef.current;
    img.crossOrigin = 'anonymous';
    img.src = previewUrl;

    const handleLoad = () => {
      const maxPreviewHeight = 280;
      const scale = Math.min(1, maxPreviewHeight / img.naturalHeight);
      const previewWidth = Math.floor(img.naturalWidth * scale);
      const previewHeight = Math.floor(img.naturalHeight * scale);

      canvas.width = previewWidth;
      canvas.height = previewHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
      }
    };

    if (img.complete) {
      handleLoad();
    } else {
      img.addEventListener('load', handleLoad);
      return () => img.removeEventListener('load', handleLoad);
    }
  }, [previewUrl]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!showResult && <ImagePlaceholder />}
        {showResult && (
          <div className="w-full overflow-hidden rounded">
            <canvas 
              ref={canvasRef}
              className="w-full h-auto"
              style={{ objectFit: 'contain' }}
            />
          </div>
        )}
        <div className="flex gap-3 items-end">
          <BlurTypeSelector node={node} />
          <BlurValueSlider node={node} />
        </div>
      </div>
    </BaseNode>
  );
});

BlurNodeComponent.displayName = 'BlurNodeComponent';

export { BlurNodeComponent };