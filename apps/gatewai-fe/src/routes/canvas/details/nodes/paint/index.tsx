import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useAppDispatch, useAppSelector } from '@/store';
import { makeSelectNodeById, updateNodeResult } from '@/store/nodes';
import { BaseNode } from '../base';
import type { PaintNode } from '../node-props';
import { useNodeImageUrl, useNodeResult } from '../../processor/processor-ctx';
import type { OutputItem, PaintNodeConfig, PaintResult } from '@gatewai/types';
import { makeSelectEdgesByTargetNodeId } from '@/store/edges';
import { makeSelectHandlesByNodeId } from '@/store/handles';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Brush, Eraser } from 'lucide-react';

const PaintNodeComponent = memo((props: NodeProps<PaintNode>) => {
  const dispatch = useAppDispatch();
  const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
  const inputNodeId = useMemo(() => {
    if (!edges || !edges[0]) {
      return undefined;
    }
    return edges[0].source;
  }, [edges]);

  const { result, isProcessing, error } = useNodeResult(props.id);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const paintOutput = useMemo(() => {
    const maskResult = result as PaintResult;
    if (!maskResult || maskResult?.selectedOutputIndex == null) {
        return null;
    }
    const output = maskResult?.outputs[maskResult.selectedOutputIndex];
    const outputItem = output?.items.find(f => f.type === 'Mask');
    return outputItem;
  }, [result])

  const inputImageUrl = useNodeImageUrl(inputNodeId);
  const handles = useAppSelector(makeSelectHandlesByNodeId(props.id));


  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');


  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const needsUpdateRef = useRef(false);
  const initializedRef = useRef(false);

  const nodeConfig = node?.config as PaintNodeConfig;

  const containerStyle = inputImageUrl ? undefined : { aspectRatio: `${nodeConfig?.width} / ${nodeConfig?.height}` };
  console.log({inputImageUrl})
   const updateResult = useCallback((dataUrl: string) => {
    const existingOutputItem = result?.outputs[result.selectedOutputIndex].items.find(f => f.type === 'Mask')
    let newResult: PaintResult | undefined = undefined;
    if (existingOutputItem) {
      newResult = {
        outputs: [{
          items: result?.outputs[result.selectedOutputIndex].items.map((item) => {
            if (item.type === 'Mask') {
              return {
                type: 'Mask',
                data: {
                  dataUrl,
                },
                outputHandleId: existingOutputItem.outputHandleId,
              } as OutputItem<"Mask">
            }
            return item as OutputItem<"Mask"> | OutputItem<"Image">;
          }).filter(f => f != null)
        }],
        selectedOutputIndex: 0,
      } as PaintResult;
    } else {
      const handle = handles.find(f => f.dataTypes.includes('Mask'));
      if (!handle) {
        console.error('Handle could not be found');
        return;
      }
      const newItems = (result?.outputs[0].items ?? []) as PaintResult["outputs"][number]["items"];
      newItems.push({
        type: 'Mask',
        data: {
          dataUrl,
        },
        outputHandleId: handle.id,
      })
      newResult = {
        selectedOutputIndex: 0,
        outputs: [{
          items: newItems
        }],
      } as PaintResult;
    }
    dispatch(updateNodeResult({ id: props.id, newResult }));
  }, [result?.outputs, result?.selectedOutputIndex, dispatch, props.id, handles]);
  console.log({paintOutput})
  // Set up canvas dimensions on image load
  const handleImageLoad = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (paintOutput?.data.dataUrl) {
      const img = new Image();
      img.src = paintOutput?.data.dataUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    } else {
      // Do not fill with backgroundColor when there's an input image; keep canvas transparent to show image underneath
      updateResult(canvas.toDataURL('image/png'));
    }
  }, [paintOutput, updateResult]);

  useEffect(() => {
    if (inputImageUrl) return;
    if (initializedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = nodeConfig?.width;
    canvas.height = nodeConfig?.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (paintOutput?.data.dataUrl) {
      const img = new Image();
      img.src = paintOutput?.data.dataUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        initializedRef.current = true;
      };
    } else {
      // ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      updateResult(canvas.toDataURL('image/png'));
      initializedRef.current = true;
    }
  }, [inputImageUrl, paintOutput, nodeConfig?.width, nodeConfig?.height, updateResult]);

  const getScaledCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getScaledCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.globalAlpha = 1;
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }
    isDrawingRef.current = true;
    lastPositionRef.current = { x, y };
    needsUpdateRef.current = true;
  }, [brushSize, tool, brushColor, getScaledCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const { x, y } = getScaledCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPositionRef.current) return;

    ctx.lineTo(x, y);
    ctx.stroke();
    lastPositionRef.current = { x, y };
  }, [getScaledCoordinates]);

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
    lastPositionRef.current = null;
    if (needsUpdateRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        updateResult(canvas.toDataURL('image/png'));
      }
      needsUpdateRef.current = false;
    }
  }, [updateResult]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updateResult(canvas.toDataURL('image/png'));
      }
    }
  }, [updateResult]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  console.log('PaintNodeComponent render', { inputImageUrl, isProcessing, error });

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        <div className="w-full overflow-hidden bg-black/5 min-h-[100px] relative select-none"
          style={{ ...containerStyle, backgroundColor: inputImageUrl ? nodeConfig.backgroundColor : undefined }}>
          {inputImageUrl && (
            <img
              ref={imageRef}
              src={inputImageUrl}
              className="block w-full h-auto pointer-events-none"
              alt="Input image for masking"
              draggable={false}
              onLoad={handleImageLoad}
            />
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-auto cursor-crosshair z-10"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          />
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <span className="text-sm text-gray-600 font-medium">Processing...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 backdrop-blur-sm">
              <div className="text-sm text-red-600 font-medium">Error: {error}</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <div className="flex gap-2">
            <Button
              size="icon"
              variant={tool === 'brush' ? 'default' : 'outline'}
              onClick={() => setTool('brush')}
            >
              <Brush className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'eraser' ? 'default' : 'outline'}
              onClick={() => setTool('eraser')}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Label htmlFor="brush-color">Color</Label>
            <input
              id="brush-color"
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-8 h-8 p-1 rounded border bg-background"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label htmlFor="brush-size">Size</Label>
            <Slider
              id="brush-size"
              min={1}
              max={100}
              step={1}
              value={[brushSize]}
              onValueChange={(value) => setBrushSize(value[0])}
              className="w-20"
            />
            <span>{brushSize}</span>
          </div>
          <Button
            variant="outline"
            onClick={handleClear}
            size="sm"
          >
            Clear
          </Button>
        </div>
      </div>
    </BaseNode>
  );
});

PaintNodeComponent.displayName = 'PaintNodeComponent';

export { PaintNodeComponent };