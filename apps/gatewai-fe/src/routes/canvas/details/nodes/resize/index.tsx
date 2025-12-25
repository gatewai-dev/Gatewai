import { memo, useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type ResizeNodeConfig,
  type NodeResult,
} from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById, updateNodeConfig, type NodeEntityType } from '@/store/nodes';
import { BaseNode } from '../base';
import type { ResizeNode } from '../node-props';
import { makeSelectAllHandles, makeSelectHandleByNodeId } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { FileAsset } from '@gatewai/db';

const ResizeWidthInput = memo(({node, originalWidth, originalHeight, maintainAspect}: {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null, maintainAspect: boolean}) => {
  const config: ResizeNodeConfig = node.config as ResizeNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valueStr = e.target.value;
    if (valueStr === '') return;
    const value = parseInt(valueStr, 10);
    if (isNaN(value) || value < 1 || value > 2000) return;
    
    let updates: Partial<ResizeNodeConfig> = { width: value };
    if (maintainAspect && originalWidth && originalHeight) {
      const newHeight = Math.round((originalHeight / originalWidth) * value);
      updates = { ...updates, height: newHeight };
    }
    
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: updates
    }));
  }, [dispatch, node.id, maintainAspect, originalWidth, originalHeight]);
  
  const displayValue = config.width ?? originalWidth ?? 0;
  
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs text-gray-600">Width: {displayValue}</label>
      <Input
        type="number"
        value={displayValue}
        min={1}
        max={2000}
        step={1}
        onChange={handleChange}
      />
    </div>
  );
});

ResizeWidthInput.displayName = 'ResizeWidthInput';

const ResizeHeightInput = memo(({node, originalWidth, originalHeight, maintainAspect}: {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null, maintainAspect: boolean}) => {
  const config: ResizeNodeConfig = node.config as ResizeNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valueStr = e.target.value;
    if (valueStr === '') return;
    const value = parseInt(valueStr, 10);
    if (isNaN(value) || value < 1 || value > 2000) return;
    
    let updates: Partial<ResizeNodeConfig> = { height: value };
    if (maintainAspect && originalWidth && originalHeight) {
      const newWidth = Math.round((originalWidth / originalHeight) * value);
      updates = { ...updates, width: newWidth };
    }
    
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: updates
    }));
  }, [dispatch, node.id, maintainAspect, originalWidth, originalHeight]);
  
  const displayValue = config.height ?? originalHeight ?? 0;
  
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs text-gray-600">Height: {displayValue}</label>
      <Input
        type="number"
        value={displayValue}
        min={1}
        max={2000}
        step={1}
        onChange={handleChange}
      />
    </div>
  );
});

ResizeHeightInput.displayName = 'ResizeHeightInput';

const AspectRatioSwitch = memo(({node, originalWidth, originalHeight}: {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null}) => {
  const config = node.config as ResizeNodeConfig & { maintainAspect?: boolean };
  const maintainAspect = config.maintainAspect ?? true;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((checked: boolean) => {
    let updates: Partial<ResizeNodeConfig & { maintainAspect: boolean }> = { maintainAspect: checked };
    if (checked && originalWidth && originalHeight) {
      const currentWidth = config.width ?? originalWidth;
      const newHeight = Math.round((originalHeight / originalWidth) * currentWidth);
      updates = { ...updates, height: newHeight };
    }
    
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: updates
    }));
  }, [dispatch, node.id, originalWidth, originalHeight, config.width]);
  
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="maintain-aspect"
        checked={maintainAspect}
        onCheckedChange={handleChange}
      />
      <Label htmlFor="maintain-aspect">Keep scaling</Label>
    </div>
  );
});

AspectRatioSwitch.displayName = 'AspectRatioSwitch';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number | null>(null);
  const [originalHeight, setOriginalHeight] = useState<number | null>(null);
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const handles = useAppSelector(makeSelectHandleByNodeId(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);
  
  const config: ResizeNodeConfig & { maintainAspect?: boolean } = (node?.config ?? props.data.config) as ResizeNodeConfig & { maintainAspect?: boolean };
  
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

  const applyResize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img || !img.complete) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const maxPreviewHeight = 280;
    const targetWidth = config.width ?? img.naturalWidth;
    const targetHeight = config.height ?? img.naturalHeight;

    let previewWidth = targetWidth;
    let previewHeight = targetHeight;

    if (targetHeight > maxPreviewHeight) {
      const scale = maxPreviewHeight / targetHeight;
      previewWidth = Math.floor(targetWidth * scale);
      previewHeight = Math.floor(targetHeight * scale);
    }

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
  }, [config.width, config.height]);
  
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
      setOriginalWidth(img.naturalWidth);
      setOriginalHeight(img.naturalHeight);
      applyResize();
    };

    img.addEventListener('load', handleImageLoad);

    if (img.src !== imgUrl) {
      img.src = imgUrl;
    } else if (img.complete) {
      setOriginalWidth(img.naturalWidth);
      setOriginalHeight(img.naturalHeight);
      applyResize();
    }

    return () => {
      img.removeEventListener('load', handleImageLoad);
    };
  }, [showResult, context?.sourceOutput, applyResize]);

  // Reapply resize when config changes
  useEffect(() => {
    if (showResult && imgRef.current?.complete) {
      applyResize();
    }
  }, [config.width, config.height, showResult, applyResize]);

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
        <div className="flex gap-3">
          <ResizeWidthInput 
            node={node}
            originalWidth={originalWidth}
            originalHeight={originalHeight}
            maintainAspect={config.maintainAspect ?? true}
          />
          <ResizeHeightInput 
            node={node}
            originalWidth={originalWidth}
            originalHeight={originalHeight}
            maintainAspect={config.maintainAspect ?? true}
          />
        </div>
        <AspectRatioSwitch 
          node={node}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      </div>
    </BaseNode>
  );
});

ResizeNodeComponent.displayName = 'ResizeNodeComponent';

export { ResizeNodeComponent };