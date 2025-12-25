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

// FAST: Stack blur - optimized separable blur
const stackBlurCanvasRGB = (
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
  
  const div = 2 * radius + 1;
  const w4 = width << 2;
  const widthMinus1 = width - 1;
  const heightMinus1 = height - 1;
  const radiusPlus1 = radius + 1;
  const sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2;
  
  const stackStart = { r: 0, g: 0, b: 0, next: null as any };
  let stack = stackStart;
  let stackEnd;
  
  for (let i = 1; i < div; i++) {
    stack = stack.next = { r: 0, g: 0, b: 0, next: null };
    if (i === radiusPlus1) stackEnd = stack;
  }
  stack.next = stackStart;
  
  let stackIn = null as any;
  let stackOut = null as any;
  
  let yw = 0;
  let yi = 0;
  
  // Horizontal blur
  for (let y = 0; y < height; y++) {
    let rInSum = 0, gInSum = 0, bInSum = 0;
    let rOutSum = 0, gOutSum = 0, bOutSum = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    
    const p = yi << 2;
    const r = pixels[p];
    const g = pixels[p + 1];
    const b = pixels[p + 2];
    
    rSum = radiusPlus1 * r;
    gSum = radiusPlus1 * g;
    bSum = radiusPlus1 * b;
    
    rInSum = r;
    gInSum = g;
    bInSum = b;
    
    stack = stackStart;
    
    for (let i = 0; i < radiusPlus1; i++) {
      stack.r = r;
      stack.g = g;
      stack.b = b;
      stack = stack.next;
    }
    
    for (let i = 1; i < radiusPlus1; i++) {
      const p2 = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
      const r2 = pixels[p2];
      const g2 = pixels[p2 + 1];
      const b2 = pixels[p2 + 2];
      
      stack.r = r2;
      stack.g = g2;
      stack.b = b2;
      stack = stack.next;
      
      rSum += r2 * (radiusPlus1 - i);
      gSum += g2 * (radiusPlus1 - i);
      bSum += b2 * (radiusPlus1 - i);
      
      rOutSum += r2;
      gOutSum += g2;
      bOutSum += b2;
    }
    
    stackIn = stackStart;
    stackOut = stackEnd;
    
    for (let x = 0; x < width; x++) {
      const pa = yi << 2;
      pixels[pa] = Math.round(rSum / sumFactor);
      pixels[pa + 1] = Math.round(gSum / sumFactor);
      pixels[pa + 2] = Math.round(bSum / sumFactor);
      
      rSum -= rOutSum;
      gSum -= gOutSum;
      bSum -= bOutSum;
      
      rOutSum -= stackIn.r;
      gOutSum -= stackIn.g;
      bOutSum -= stackIn.b;
      
      let p = x + radius + 1;
      const p3 = (yw + (p < widthMinus1 ? p : widthMinus1)) << 2;
      
      rInSum += (stackIn.r = pixels[p3]);
      gInSum += (stackIn.g = pixels[p3 + 1]);
      bInSum += (stackIn.b = pixels[p3 + 2]);
      
      rSum += rInSum;
      gSum += gInSum;
      bSum += bInSum;
      
      stackIn = stackIn.next;
      
      rOutSum += stackOut.r;
      gOutSum += stackOut.g;
      bOutSum += stackOut.b;
      
      rInSum -= stackOut.r;
      gInSum -= stackOut.g;
      bInSum -= stackOut.b;
      
      stackOut = stackOut.next;
      
      yi++;
    }
    yw += width;
  }
  
  // Vertical blur
  for (let x = 0; x < width; x++) {
    let rInSum = 0, gInSum = 0, bInSum = 0;
    let rOutSum = 0, gOutSum = 0, bOutSum = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    
    yi = x << 2;
    const r = pixels[yi];
    const g = pixels[yi + 1];
    const b = pixels[yi + 2];
    
    rSum = radiusPlus1 * r;
    gSum = radiusPlus1 * g;
    bSum = radiusPlus1 * b;
    
    rInSum = r;
    gInSum = g;
    bInSum = b;
    
    stack = stackStart;
    
    for (let i = 0; i < radiusPlus1; i++) {
      stack.r = r;
      stack.g = g;
      stack.b = b;
      stack = stack.next;
    }
    
    let yp = width;
    
    for (let i = 1; i < radiusPlus1; i++) {
      yi = (yp + x) << 2;
      
      const r2 = pixels[yi];
      const g2 = pixels[yi + 1];
      const b2 = pixels[yi + 2];
      
      stack.r = r2;
      stack.g = g2;
      stack.b = b2;
      stack = stack.next;
      
      rSum += r2 * (radiusPlus1 - i);
      gSum += g2 * (radiusPlus1 - i);
      bSum += b2 * (radiusPlus1 - i);
      
      rOutSum += r2;
      gOutSum += g2;
      bOutSum += b2;
      
      if (i < heightMinus1) {
        yp += width;
      }
    }
    
    yi = x;
    stackIn = stackStart;
    stackOut = stackEnd;
    
    for (let y = 0; y < height; y++) {
      const p4 = yi << 2;
      pixels[p4] = Math.round(rSum / sumFactor);
      pixels[p4 + 1] = Math.round(gSum / sumFactor);
      pixels[p4 + 2] = Math.round(bSum / sumFactor);
      
      rSum -= rOutSum;
      gSum -= gOutSum;
      bSum -= bOutSum;
      
      rOutSum -= stackIn.r;
      gOutSum -= stackIn.g;
      bOutSum -= stackIn.b;
      
      let p = y + radiusPlus1;
      const p5 = (x + (p < heightMinus1 ? p : heightMinus1) * width) << 2;
      
      rInSum += (stackIn.r = pixels[p5]);
      gInSum += (stackIn.g = pixels[p5 + 1]);
      bInSum += (stackIn.b = pixels[p5 + 2]);
      
      rSum += rInSum;
      gSum += gInSum;
      bSum += bInSum;
      
      stackIn = stackIn.next;
      
      rOutSum += stackOut.r;
      gOutSum += stackOut.g;
      bOutSum += stackOut.b;
      
      rInSum -= stackOut.r;
      gInSum -= stackOut.g;
      bInSum -= stackOut.b;
      
      stackOut = stackOut.next;
      
      yi += width;
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
      stackBlurCanvasRGB(ctx, 0, 0, previewWidth, previewHeight, config.size);
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