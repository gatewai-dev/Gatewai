import { memo, useEffect, useRef } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { BlurValueSlider } from './blur-slider';
import { useNodeImageUrl, useNodeResult } from '../../processor/processor-ctx';

const ImagePlaceholder = () => (
  <div className="w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700">
    <span className="text-gray-400 text-sm">No image connected</span>
  </div>
);

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Get processed result from processor
  const { result, isProcessing, error } = useNodeResult(props.id);
  const imageUrl = useNodeImageUrl(props.id);
  
  // Draw to canvas when result is ready
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
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
  console.log('BlurNodeComponent render', { imageUrl, isProcessing, error });
  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!result ? (
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