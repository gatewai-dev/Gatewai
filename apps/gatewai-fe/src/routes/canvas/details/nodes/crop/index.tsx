import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useAppDispatch, useAppSelector } from '@/store';
import { makeSelectNodeById, updateNodeConfig } from '@/store/nodes';
import { BaseNode } from '../base';
import type { CropNode } from '../node-props';
import { useNodeImageUrl, useNodeResult } from '../../processor/processor-ctx';
import type { CropNodeConfig } from '@gatewai/types';
import { makeSelectHandlesByNodeId } from '@/store/handles';
import { makeSelectEdgesByTargetNodeId } from '@/store/edges';

const ImagePlaceholder = () => (
  <div className="w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700">
    <span className="text-gray-400 text-sm">No image connected</span>
  </div>
);

type Crop = {
  leftPercentage: number;
  topPercentage: number;
  widthPercentage: number;
  heightPercentage: number;
};

type DragState = {
  type: 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-w' | 'resize-e';
  startX: number;
  startY: number;
  startCrop: Crop;
};

const CropNodeComponent = memo((props: NodeProps<CropNode>) => {
  const dispatch = useAppDispatch();
  const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
  const inputNodeId = useMemo(() => {
    if (!edges || !edges[0]) {
        return undefined;
    }
    return edges[0].source;
  }, [edges])

  const node = useAppSelector(makeSelectNodeById(props.id));
  const { isProcessing, error } = useNodeResult(props.id);
  const inputImageUrl = useNodeImageUrl(inputNodeId);
  const imageRef = useRef<HTMLImageElement>(null);
  const nodeConfig = node?.config as CropNodeConfig;
  const [crop, setCrop] = useState<Crop>({
    leftPercentage: nodeConfig?.leftPercentage ?? 0,
    topPercentage: nodeConfig?.topPercentage ?? 0,
    widthPercentage: nodeConfig?.widthPercentage ?? 100,
    heightPercentage: nodeConfig?.heightPercentage ?? 100,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const latestCropRef = useRef(crop);

  // Keep ref in sync with crop state
  useEffect(() => {
    latestCropRef.current = crop;
  }, [crop]);

  // Sync local crop with node config
  useEffect(() => {
    if (nodeConfig) {
      setCrop({
        leftPercentage: nodeConfig.leftPercentage ?? 0,
        topPercentage: nodeConfig.topPercentage ?? 0,
        widthPercentage: nodeConfig.widthPercentage ?? 100,
        heightPercentage: nodeConfig.heightPercentage ?? 100,
      });
    }
  }, [nodeConfig]);

  const updateConfig = useCallback((newCrop: Crop) => {
    dispatch(updateNodeConfig({ id: props.id, newConfig: newCrop }));
  }, [dispatch, props.id]);

  const constrainCrop = useCallback((newCrop: Crop): Crop => {
    let { leftPercentage, topPercentage, widthPercentage, heightPercentage } = newCrop;
    
    // Ensure minimum dimensions
    widthPercentage = Math.max(5, widthPercentage);
    heightPercentage = Math.max(5, heightPercentage);
    
    // Clamp width and height to 100% max
    widthPercentage = Math.min(100, widthPercentage);
    heightPercentage = Math.min(100, heightPercentage);
    
    // Clamp position so crop box stays within image bounds
    leftPercentage = Math.max(0, Math.min(100 - widthPercentage, leftPercentage));
    topPercentage = Math.max(0, Math.min(100 - heightPercentage, topPercentage));
    
    return {
      leftPercentage,
      topPercentage,
      widthPercentage,
      heightPercentage,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: DragState["type"]) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    });
  }, [crop]);

  useEffect(() => {
    if (!dragState || !imageRef.current) return;

    const imageRect = imageRef.current.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const dx = ((e.clientX - dragState.startX) / imageRect.width) * 100;
      const dy = ((e.clientY - dragState.startY) / imageRect.height) * 100;
      let newCrop = { ...dragState.startCrop };

      switch (dragState.type) {
        case 'move':
          newCrop.leftPercentage += dx;
          newCrop.topPercentage += dy;
          break;
        case 'resize-nw':
          newCrop.leftPercentage += dx;
          newCrop.topPercentage += dy;
          newCrop.widthPercentage -= dx;
          newCrop.heightPercentage -= dy;
          break;
        case 'resize-ne':
          newCrop.topPercentage += dy;
          newCrop.widthPercentage += dx;
          newCrop.heightPercentage -= dy;
          break;
        case 'resize-sw':
          newCrop.leftPercentage += dx;
          newCrop.widthPercentage -= dx;
          newCrop.heightPercentage += dy;
          break;
        case 'resize-se':
          newCrop.widthPercentage += dx;
          newCrop.heightPercentage += dy;
          break;
        case 'resize-n':
          newCrop.topPercentage += dy;
          newCrop.heightPercentage -= dy;
          break;
        case 'resize-s':
          newCrop.heightPercentage += dy;
          break;
        case 'resize-w':
          newCrop.leftPercentage += dx;
          newCrop.widthPercentage -= dx;
          break;
        case 'resize-e':
          newCrop.widthPercentage += dx;
          break;
      }

      newCrop = constrainCrop(newCrop);
      setCrop(newCrop);
    };

    const handleMouseUp = () => {
      // Use the latest crop value from ref to avoid stale closure
      updateConfig(latestCropRef.current);
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, constrainCrop, updateConfig]);

  console.log('CropNodeComponent render', { inputImageUrl, isProcessing, error });

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!inputImageUrl ? (
          <ImagePlaceholder />
        ) : (
          <div className="w-full overflow-hidden rounded bg-black/5 min-h-[100px] relative select-none">
            <img
              ref={imageRef}
              src={inputImageUrl}
              className="block w-full h-auto"
              alt="Input image for cropping"
              draggable={false}
            />
            
            {/* Dark overlay for cropped-out areas */}
            <div className="absolute inset-0 pointer-events-none">
              <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                  <mask id={`crop-mask-${props.id}`}>
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={`${crop.leftPercentage}%`}
                      y={`${crop.topPercentage}%`}
                      width={`${crop.widthPercentage}%`}
                      height={`${crop.heightPercentage}%`}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0, 0, 0, 0.6)"
                  mask={`url(#crop-mask-${props.id})`}
                />
              </svg>
            </div>

            {/* Crop selection box */}
            <div
              className="absolute box-border border-2 border-white shadow-lg"
              style={{
                left: `${crop.leftPercentage}%`,
                top: `${crop.topPercentage}%`,
                width: `${crop.widthPercentage}%`,
                height: `${crop.heightPercentage}%`,
                cursor: dragState?.type === 'move' ? 'grabbing' : 'grab',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0)',
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
              {/* Corner handles */}
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize shadow-md hover:scale-110 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'resize-nw')}
              />
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize shadow-md hover:scale-110 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'resize-ne')}
              />
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize shadow-md hover:scale-110 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'resize-sw')}
              />
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-se-resize shadow-md hover:scale-110 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'resize-se')}
              />
              
              {/* Side handles - only show if crop box is large enough */}
              {crop.widthPercentage > 15 && (
                <>
                  <div
                    className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-n-resize shadow-md hover:scale-110 transition-transform"
                    onMouseDown={(e) => handleMouseDown(e, 'resize-n')}
                  />
                  <div
                    className="absolute -bottom-2 left-1/2 -ml-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-s-resize shadow-md hover:scale-110 transition-transform"
                    onMouseDown={(e) => handleMouseDown(e, 'resize-s')}
                  />
                </>
              )}
              {crop.heightPercentage > 15 && (
                <>
                  <div
                    className="absolute top-1/2 -left-2 -mt-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-w-resize shadow-md hover:scale-110 transition-transform"
                    onMouseDown={(e) => handleMouseDown(e, 'resize-w')}
                  />
                  <div
                    className="absolute top-1/2 -right-2 -mt-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-e-resize shadow-md hover:scale-110 transition-transform"
                    onMouseDown={(e) => handleMouseDown(e, 'resize-e')}
                  />
                </>
              )}

              {/* Rule of thirds grid lines */}
              <div className="absolute inset-0 pointer-events-none opacity-50">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/50" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/50" />
              </div>
            </div>

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
      </div>
    </BaseNode>
  );
});

CropNodeComponent.displayName = 'CropNodeComponent';

export { CropNodeComponent };