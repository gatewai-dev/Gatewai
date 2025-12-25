import { memo, useEffect, useMemo, useRef, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type BlurNodeConfig,
  type NodeResult,
} from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById, updateNodeConfig, type NodeEntityType } from '@/store/nodes';
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
import type { FileAsset } from '@gatewai/db';

const BLUR_TYPES = ['Box', 'Gaussian'] as const;

// Simple box blur implementation
const boxBlurCanvasRGB = (
  ctx: CanvasRenderingContext2D,
  top_x: number,
  top_y: number,
  width: number,
  height: number,
  radius: number
) => {
  if (radius < 1) return;
  
  radius = Math.floor(radius);
  
  const imageData = ctx.getImageData(top_x, top_y, width, height);
  const pixels = imageData.data;
  const tempPixels = new Uint8ClampedArray(pixels);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let kx = -radius; kx <= radius; kx++) {
        const px = x + kx;
        if (px >= 0 && px < width) {
          const idx = (y * width + px) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      tempPixels[idx] = r / count;
      tempPixels[idx + 1] = g / count;
      tempPixels[idx + 2] = b / count;
      tempPixels[idx + 3] = pixels[idx + 3];
    }
  }
  
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let ky = -radius; ky <= radius; ky++) {
        const py = y + ky;
        if (py >= 0 && py < height) {
          const idx = (py * width + x) * 4;
          r += tempPixels[idx];
          g += tempPixels[idx + 1];
          b += tempPixels[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      pixels[idx] = r / count;
      pixels[idx + 1] = g / count;
      pixels[idx + 2] = b / count;
    }
  }
  
  ctx.putImageData(imageData, top_x, top_y);
};

const BlurValueSlider = memo(({node}: {node: NodeEntityType}) => {
  const config: BlurNodeConfig = node.config as BlurNodeConfig;
  const dispatch = useAppDispatch();
  const timeoutRef = useRef<number | null>(null);
  
  const handleChange = useCallback((value: number[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
      dispatch(updateNodeConfig({
        id: node.id,
        newConfig: { size: value[0] }
      }));
  }, [dispatch, node.id]);
  
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

const BlurTypeSelector = memo(({node}: {node: NodeEntityType}) => {
  const config = node.config as BlurNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((blurType: string) => {
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: { blurType }
    }));
  }, [dispatch, node.id]);
  
  return (
    <Select 
      value={config.blurType ?? 'Box'}
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

  // OPTIMIZED: Fast blur using CSS filter or stack blur
  const applyBlur = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img || !img.complete) {
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    const maxPreviewHeight = 280;
    const scale = Math.min(1, maxPreviewHeight / img.naturalHeight);
    const previewWidth = Math.floor(img.naturalWidth * scale);
    const previewHeight = Math.floor(img.naturalHeight * scale);

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // FAST: Use CSS filter for blur (hardware accelerated)
    if (config.blurType === 'Gaussian' && config.size && config.size > 0) {
      ctx.filter = `blur(${config.size}px)`;
      ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
      ctx.filter = 'none';
    } 
    // FAST: Use optimized stack blur for Box
    else if (config.blurType === 'Box' && config.size && config.size > 0) {
      ctx.filter = 'none';
      ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
      boxBlurCanvasRGB(ctx, 0, 0, previewWidth, previewHeight, config.size);
    } 
    // No blur
    else {
      ctx.filter = 'none';
      ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
    }
  }, [config.size, config.blurType]);
  
  // Load image
  useEffect(() => {
    if (!showResult || !context?.sourceOutput) {
      return;
    }
    
    const imgUrl = (context.sourceOutput.data.entity as FileAsset)?.signedUrl;
    if (!imgUrl) {
      return;
    }

    if (!imgRef.current) {
      imgRef.current = new Image();
    }

    const img = imgRef.current;
    img.crossOrigin = 'anonymous';

    const handleImageLoad = () => {
      applyBlur();
    };

    img.addEventListener('load', handleImageLoad);

    if (img.src !== imgUrl) {
      img.src = imgUrl;
    } else if (img.complete) {
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