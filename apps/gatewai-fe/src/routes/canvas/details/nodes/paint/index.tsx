import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useAppDispatch, useAppSelector } from '@/store';
import { updateNodeResult } from '@/store/nodes';
import { BaseNode } from '../base';
import type { PaintNode } from '../node-props';
import { useNodeImageUrl, useNodeResult } from '../../processor/processor-ctx';
import type { OutputItem, PaintResult } from '@gatewai/types';
import { makeSelectEdgesByTargetNodeId } from '@/store/edges';
import { makeSelectHandlesByNodeId } from '@/store/handles';

const ImagePlaceholder = () => (
  <div className="w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700">
    <span className="text-gray-400 text-sm">No image connected</span>
  </div>
);

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
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const needsUpdateRef = useRef(false);

  // Load existing mask if available
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !paintOutput?.data.dataUrl) return;

    const img = new Image();
    img.src = paintOutput?.data.dataUrl;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
  }, [paintOutput?.data.dataUrl, inputImageUrl]);

  // Set up canvas dimensions on image load
  const handleImageLoad = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    setWidth(image.naturalWidth);
    setHeight(image.naturalHeight);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

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
        outputs: {
          items: newItems
        },
      }
    }
    dispatch(updateNodeResult({ id: props.id, newResult: newResult as PaintResult }));
  }, [result?.outputs, result?.selectedOutputIndex, dispatch, props.id, handles]);


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
    ctx.globalAlpha = brushOpacity / 100;
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }
    isDrawingRef.current = true;
    lastPositionRef.current = { x, y };
    needsUpdateRef.current = true;
  }, [brushSize, brushOpacity, tool, brushColor, getScaledCoordinates]);

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
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updateResult(canvas.toDataURL('image/png'));
      }
    }
  }, []);

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
        {!inputImageUrl ? (
          <ImagePlaceholder />
        ) : (
          <div className="w-full overflow-hidden bg-black/5 min-h-[100px] relative select-none">
            <img
              ref={imageRef}
              src={inputImageUrl}
              className="block w-full h-auto pointer-events-none"
              alt="Input image for masking"
              draggable={false}
              onLoad={handleImageLoad}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-auto cursor-crosshair"
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
        )}
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setTool('brush')}
              className={`px-2 py-1 rounded ${tool === 'brush' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Brush
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`px-2 py-1 rounded ${tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Eraser
            </button>
          </div>
          <label className="flex items-center gap-1">
            Color:
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-8 h-6 border rounded"
            />
          </label>
          <label className="flex items-center gap-1">
            Opacity:
            <input
              type="range"
              min={0}
              max={100}
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
              className="w-20"
            />
            {brushOpacity}%
          </label>
          <label className="flex items-center gap-1">
            Size:
            <input
              type="range"
              min={1}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20"
            />
            {brushSize}
          </label>
          <button
            onClick={handleClear}
            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
          >
            Clear
          </button>
          <span>W {width} H {height}</span>
        </div>
      </div>
    </BaseNode>
  );
});

PaintNodeComponent.displayName = 'PaintNodeComponent';

export { PaintNodeComponent };