import { memo, useEffect, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { ResizeNode } from '../node-props';
import { AspectRatioSwitch } from './aspect-ratio-switch';
import { ResizeHeightInput } from './height-input';
import { ResizeWidthInput } from './width-input';
import type { config } from 'process';
import { useNodeResult, useNodeImageUrl } from '../../processor/processor-ctx';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Get processed result from processor
  const { result, isProcessing, error } = useNodeResult(props.id);
  const imageUrl = useNodeImageUrl(props.id);
  
  // Draw to canvas when result is ready
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }, [imageUrl]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        
        {!result && !isProcessing ? (
          <ImagePlaceholder />
        ) : (
          <div className="w-full overflow-hidden rounded bg-black/5 min-h-[100px] relative">
            <canvas ref={canvasRef} className="block w-full h-auto" />
            
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50/90">
                <div className="text-sm text-red-600">Error: {error}</div>
              </div>
            )}
          </div>
        )}
        {node && (
          <>
            <div className="flex gap-3">
              <ResizeWidthInput
                node={node}
                originalWidth={null}
                originalHeight={null}
                maintainAspect={node.config?.maintainAspect ?? true}
              />
              <ResizeHeightInput
                node={node}
                originalWidth={null}
                originalHeight={null}
                maintainAspect={node.config?.maintainAspect ?? true}
              />
            </div>
            <AspectRatioSwitch
              node={node}
              originalWidth={null}
              originalHeight={null}
            />
          </>
        )}
      </div>
    </BaseNode>
  );
});

ResizeNodeComponent.displayName = 'ResizeNodeComponent';

export { ResizeNodeComponent };