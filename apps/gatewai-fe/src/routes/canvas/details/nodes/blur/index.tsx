import { memo, useEffect, useMemo, useRef, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type BlurNodeConfig,
  type FileData,
  type NodeResult,
} from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById, updateNodeConfig } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { makeSelectAllHandles, makeSelectHandleByNodeId } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

const BLUR_TYPES = ['Box', 'Gaussian'] as const;

// Blur algorithms
const applyBoxBlur = (
  imageData: ImageData,
  radius: number
): ImageData => {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  
  const size = radius * 2 + 1;
  const divisor = size * size;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const i = (py * w + px) * 4;
          
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
        }
      }
      
      const i = (y * w + x) * 4;
      dst[i] = r / divisor;
      dst[i + 1] = g / divisor;
      dst[i + 2] = b / divisor;
      dst[i + 3] = a / divisor;
    }
  }
  
  return new ImageData(dst, w, h);
};

const applyConvolution = (
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  kernel: Float32Array,
  horizontal: boolean
): void => {
  const radius = Math.floor(kernel.length / 2);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      
      for (let k = 0; k < kernel.length; k++) {
        const offset = k - radius;
        let px: number, py: number;
        
        if (horizontal) {
          px = Math.min(w - 1, Math.max(0, x + offset));
          py = y;
        } else {
          px = x;
          py = Math.min(h - 1, Math.max(0, y + offset));
        }
        
        const i = (py * w + px) * 4;
        const weight = kernel[k];
        
        r += src[i] * weight;
        g += src[i + 1] * weight;
        b += src[i + 2] * weight;
        a += src[i + 3] * weight;
      }
      
      const i = (y * w + x) * 4;
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }
  }
};

const applyGaussianBlur = (
  imageData: ImageData,
  radius: number
): ImageData => {
  const w = imageData.width;
  const h = imageData.height;
  
  // Create Gaussian kernel
  const sigma = radius / 3;
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  
  // Normalize kernel
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  
  // Apply horizontal pass
  const temp = new Uint8ClampedArray(imageData.data);
  applyConvolution(imageData.data, temp, w, h, kernel, true);
  
  // Apply vertical pass
  const result = new Uint8ClampedArray(imageData.data.length);
  applyConvolution(temp, result, w, h, kernel, false);
  
  return new ImageData(result, w, h);
};

const BlurValueSlider = memo((props: NodeProps<BlurNode>) => {
  const config: BlurNodeConfig = props.data.config;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((value: number[]) => {
    dispatch(updateNodeConfig({
      id: props.id,
      newConfig: { size: value[0] }
    }));
  }, [dispatch, props.id]);
  
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs text-gray-600">Blur Size: {config.size ?? 0}</label>
      <Slider
        value={[config.size ?? 0]}
        max={20}
        min={0}
        step={1}
        onValueChange={handleChange}
      />
    </div>
  );
});

BlurValueSlider.displayName = 'BlurValueSlider';

const BlurTypeSelector = memo((props: NodeProps<BlurNode>) => {
  const config: BlurNodeConfig = props.data.config;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((blurType: string) => {
    dispatch(updateNodeConfig({
      id: props.id,
      newConfig: { blurType }
    }));
  }, [dispatch, props.id]);
  
  return (
    <Select 
      value={config.blurType}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        {BLUR_TYPES.map((bt) => (
          <SelectItem key={bt} value={bt}>
            {bt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

BlurTypeSelector.displayName = 'BlurTypeSelector';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center bg-gray-100 rounded">
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
  
  const config: BlurNodeConfig = props.data.config;
  
  const context = useMemo(() => {
    if (!node || !handles.length) {
      return null;
    }
    
    // Blur node has single input handle
    const targetHandle = handles[0];
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

  // Apply blur effect
  const applyBlur = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img || !img.complete) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context not available');
      return;
    }

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Apply blur if size > 0
    if (config.size && config.size > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let blurredData: ImageData;

      try {
        if (config.blurType === 'Box') {
          blurredData = applyBoxBlur(imageData, config.size);
        } else if (config.blurType === 'Gaussian') {
          blurredData = applyGaussianBlur(imageData, config.size);
        } else {
          // Fallback to no blur
          return;
        }

        ctx.putImageData(blurredData, 0, 0);
      } catch (error) {
        console.error('Error applying blur:', error);
      }
    }
  }, [config.size, config.blurType]);
  
  // Load and process image
  useEffect(() => {
    if (!showResult || !context?.sourceOutput) {
      return;
    }

    const imgUrl = (context.sourceOutput.data as FileData)?.url;
    if (!imgUrl) {
      return;
    }

    // Create or reuse image element
    if (!imgRef.current) {
      imgRef.current = new Image();
    }

    const img = imgRef.current;

    const handleImageLoad = () => {
      applyBlur();
    };

    img.addEventListener('load', handleImageLoad);

    // Set source after adding event listener
    if (img.src !== imgUrl) {
      img.src = imgUrl;
    } else if (img.complete) {
      // Image already loaded
      applyBlur();
    }

    return () => {
      img.removeEventListener('load', handleImageLoad);
    };
  }, [showResult, context?.sourceOutput, applyBlur]);

  // Reapply blur when config changes
  useEffect(() => {
    if (showResult && imgRef.current?.complete) {
      applyBlur();
    }
  }, [config.size, config.blurType, showResult, applyBlur]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!showResult && <ImagePlaceholder />}
        {showResult && (
          <div className="w-full overflow-hidden rounded">
            <canvas 
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: '280px', objectFit: 'contain' }}
            />
          </div>
        )}
        <div className="flex gap-3 items-end">
          <BlurTypeSelector {...props} />
          <BlurValueSlider {...props} />
        </div>
      </div>
    </BaseNode>
  );
});

BlurNodeComponent.displayName = 'BlurNodeComponent';

export { BlurNodeComponent };