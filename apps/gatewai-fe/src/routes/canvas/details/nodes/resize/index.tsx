import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type ResizeNodeConfig,
  type FileData,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { ResizeNode } from '../node-props';
import { makeSelectAllHandles } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import { AspectRatioSwitch } from './aspect-ratio-switch';
import { ResizeHeightInput } from './height-input';
import { ResizeWidthInput } from './width-input';
import { browserNodeProcessors } from '../node-processors';
import { useNodeContext } from '../hooks/use-node-ctx';
import { useHandleValueResolver } from '../hooks/use-handle-value-resolver';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);

  const config: ResizeNodeConfig = (node?.config ?? props.data.config) as ResizeNodeConfig;

  const context = useNodeContext({nodeId: props.id})
  const output = useHandleValueResolver({handleId: context?.inputHandles[0].id ?? "0", nodeId: props.id})
  console.log({output, nodeId: props.id})
  const showResult = output != null;
  const nodeConfig = node?.config as ResizeNodeConfig;

  const inputImageUrl = useMemo(() => {
    const generation = output?.outputs[output.selectedOutputIndex];
    if (!generation) return null;
    const genData = generation.items[0];
    return (genData?.data as FileData)?.dataUrl || (genData?.data as FileData)?.entity?.signedUrl
  }, [output]);

  // Compute a key to detect changes in input or config
  const computeKey = useMemo(() => {
    if (!inputImageUrl) return null;
    return inputImageUrl + JSON.stringify(config, Object.keys(config).sort());
  }, [inputImageUrl, config]);
  console.log({computeKey, inputImageUrl})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number | null>(null);
  const [originalHeight, setOriginalHeight] = useState<number | null>(null);

  // Load input image to get original dimensions
  useEffect(() => {
    if (!showResult || !inputImageUrl) {
      setOriginalWidth(null);
      setOriginalHeight(null);
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
    };

    img.addEventListener('load', handleImageLoad);

    if (img.src !== inputImageUrl) {
      img.src = inputImageUrl;
    } else if (img.complete) {
      setOriginalWidth(img.naturalWidth);
      setOriginalHeight(img.naturalHeight);
    }

    return () => {
      img.removeEventListener('load', handleImageLoad);
    };
  }, [showResult, inputImageUrl]);

  // Compute the resize using the processor
  useEffect(() => {
    if (!showResult || !computeKey || !node) {
      setPreviewUrl(null);
      return;
    }

    const compute = async () => {
      const data = {
        nodes: allNodes,
        edges: allEdges,
        handles: allHandles,
      };
      const processor = browserNodeProcessors['Resize'];
      if (!processor) {
        console.error('Resize processor not found');
        return;
      }
      if (!originalHeight || !originalWidth) {
        return;
      }
      const res = await processor({ node, data, extraArgs: { 
        resolvedInputResult: output,
        originalHeight: originalHeight,
        originalWidth: originalWidth,
        maintainAspect: nodeConfig.maintainAspect ?? true
      } });

      if (res.success && res.newResult) {
        const dataUrl = (res.newResult.outputs[0].items[0].data as FileData).dataUrl;
        if (dataUrl) {
          setPreviewUrl(dataUrl);
        }
      } else {
        console.error('Failed to process resize:', res.error);
      }
    };

    compute();
  }, [computeKey, showResult, node, allNodes, allEdges, allHandles, output, nodeConfig?.width, nodeConfig?.height, originalHeight, originalWidth, nodeConfig?.maintainAspect]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!showResult && <ImagePlaceholder />}
        {showResult && previewUrl && (
          <div className="w-full overflow-hidden rounded" style={{ height: '280px' }}>
            <img
              src={previewUrl}
              alt="Resized preview"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
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