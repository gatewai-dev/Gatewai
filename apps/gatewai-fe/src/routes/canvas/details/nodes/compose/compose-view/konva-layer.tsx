import React, { useEffect, useState, useRef } from 'react';
import { Image, Transformer, Group } from 'react-konva';
import { color } from '@/colors';

const CompKonvaLayer = ({
  layer,
  image,
  isSelected,
  isLocked,
  onSelect,
  onTransform,
  onCommitTransform,
  spacePressed,
}) => {
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  /// transformer
  useEffect(() => {
    if (isSelected && transformerRef.current) {
      transformerRef.current.nodes([layerRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    if (isSelected && transformerRef.current && layerRef.current) {
      // Force transformer to update its size
      transformerRef.current.nodes([layerRef.current]);

      // Update the Group's dimensions to match the new width/height
      if (layerRef.current) {
        layerRef.current.size({
          width: layer.transform.width,
          height: layer.transform.height,
        });
      }

      // Redraw the layer to show updates
      transformerRef.current.getLayer().batchDraw();
    }
  }, [layer.transform.width, layer.transform.height, isSelected]);

  // END transformer

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Force a redraw of the layer to show the stroke immediately
    layerRef.current?.getLayer()?.batchDraw();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Force a redraw of the layer to remove the stroke immediately
    layerRef.current?.getLayer()?.batchDraw();
  };

  const handleTransformUpdate = () => {
    // Throttle position updates to reduce frequency of state updates
    if (!layerRef.current._throttleTimeout) {
      layerRef.current._throttleTimeout = setTimeout(() => {
        layerRef.current._throttleTimeout = null;
      }, 15);
    } else {
      return; // Skip update if within throttle window
    }
    const updatedLayer = {
      ...layer,
      transform: {
        x: layerRef.current.x(),
        y: layerRef.current.y(),
        scaleX: layerRef.current.scaleX(),
        scaleY: layerRef.current.scaleY(),
        rotation: layerRef.current.rotation(),
        width: layer.transform.width,
        height: layer.transform.height,
      },
    };
    onTransform(updatedLayer);
  };

  const commitTransformUpdate = () => {
    const updatedLayer = {
      ...layer,
      transform: {
        x: layerRef.current.x(),
        y: layerRef.current.y(),
        scaleX: layerRef.current.scaleX(),
        scaleY: layerRef.current.scaleY(),
        rotation: layerRef.current.rotation(),
        width: layer.transform.width,
        height: layer.transform.height,
      },
    };
    onCommitTransform(updatedLayer);
  };

  return (
    <>
      <Group
        x={layer.transform.x}
        y={layer.transform.y}
        scaleX={layer.transform.scaleX}
        scaleY={layer.transform.scaleY}
        rotation={layer.transform.rotation}
        draggable={!spacePressed && !isLocked}
        ref={layerRef}
        onClick={!isLocked ? onSelect : undefined}
        onDragStart={onSelect}
        onDragEnd={commitTransformUpdate}
        onDragMove={handleTransformUpdate}
        onTransform={handleTransformUpdate}
        onTransformEnd={commitTransformUpdate}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          image={image}
          width={layer.transform.width}
          height={layer.transform.height}
          stroke={isHovered && !isSelected ? color.Yambo_Purple_Stroke : 'transparent'}
          strokeWidth={isHovered && !isSelected ? 3 : 0}
          strokeScaleEnabled={false}
          globalCompositeOperation={layer.blend_mode}
        />
      </Group>
      {isSelected && !isLocked && (
        <Transformer
          ref={transformerRef}
          borderStroke={color.Yambo_Purple}
          borderStrokeWidth={2}
          anchorStroke={color.Yambo_Purple_Dark}
          anchorFill={color.Yambo_Purple}
          anchorSize={6}
          anchorCornerRadius={20}
          rotateAnchorOffset={20}
          enabledAnchors={[
            'top-left',
            'top-center',
            'top-right',
            'middle-left',
            'middle-right',
            'bottom-left',
            'bottom-center',
            'bottom-right',
          ]}
        />
      )}
    </>
  );
};

const CompKonvaLayerMemoized = React.memo(CompKonvaLayer);

export { CompKonvaLayerMemoized as CompKonvaLayer };
