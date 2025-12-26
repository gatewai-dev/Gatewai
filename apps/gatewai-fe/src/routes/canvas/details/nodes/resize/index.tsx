import { memo, useEffect, useMemo, useRef } from 'react';
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
import { browserNodeProcessors } from '../../node-processors';
import { useNodeContext } from '../hooks/use-node-ctx';
import { useNodeInputValuesResolver } from '../hooks/use-handle-value-resolver';
import { GetAssetEndpoint } from '@/utils/file';

const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const config: ResizeNodeConfig = (node?.config ?? props.data.config) as ResizeNodeConfig;

  const resolverArgs = useMemo(() => ({ nodeId: props.id }), [props.id]);

  const context = useNodeContext(resolverArgs);
  const nodeInputContext = useNodeInputValuesResolver(resolverArgs);

  const shouldUseLocalImageData = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return false;
    }
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
    const cachedValue = imageHandleCtx?.cachedResultValue;
    if (cachedValue && cachedValue.data) {
      return true;
    }
    return false;
  }, [context?.inputHandles, nodeInputContext]);

  const inputImageResult = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return null;
    }
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
    const cachedValue = imageHandleCtx?.cachedResultValue;
    if (cachedValue && cachedValue.data) {
      return cachedValue;
    }
    const connectedNodeValue = imageHandleCtx?.resultValue;

    if (connectedNodeValue && connectedNodeValue.data) {
      return connectedNodeValue;
    }
    return null;
  }, [context?.inputHandles, nodeInputContext]);


  const inputImageUrl = useMemo(() => {
    if (inputImageResult) {
      const fileData = inputImageResult.data as FileData;
      if (fileData?.entity?.id) {
        return GetAssetEndpoint(fileData.entity.id)
      }
      return fileData.dataUrl;
    };
    return null;
  }, [inputImageResult]);

  // Compute a key to detect changes in input or config
  const computeKey = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return null;
    }
    if (!inputImageUrl) return null;
    let computeKey = '';
    if (shouldUseLocalImageData) {
      const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id];
      const cachedResult = imageHandleCtx?.cachedResult;
      const hash = cachedResult?.hash ?? '';
      computeKey += hash;
    } else {
      computeKey += inputImageUrl;
    }
    computeKey += JSON.stringify(config, Object.keys(config).sort());
    return computeKey;
  }, [context?.inputHandles, inputImageUrl, config, shouldUseLocalImageData, nodeInputContext]);

  // Compute the resize using the processor
  useEffect(() => {
    if (!inputImageUrl || !computeKey || !node || !context?.inputHandles[0].id || !canvasRef.current) {
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
      processor({
        node,
        data,
        extraArgs: {
          nodeInputContextData: nodeInputContext[context?.inputHandles[0].id],
          canvas: canvasRef.current
        }
      });
    };

    compute();
  }, [allEdges, allHandles, allNodes, computeKey, context?.inputHandles, inputImageUrl, node, nodeInputContext]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!inputImageUrl && <ImagePlaceholder />}
        {inputImageUrl && (
          <div className="w-full overflow-hidden rounded">
            <canvas ref={canvasRef} />
          </div>
        )}
        {node && (
          <>
            <div className="flex gap-3">
              <ResizeWidthInput
                node={node}
                originalWidth={null}
                originalHeight={null}
                maintainAspect={config.maintainAspect ?? true}
              />
              <ResizeHeightInput
                node={node}
                originalWidth={null}
                originalHeight={null}
                maintainAspect={config.maintainAspect ?? true}
              />
            </div>
            <AspectRatioSwitch
              node={node}
              originalWidth={null}
              originalHeight={null}
            />
          </>
        )}
      </div>
    </BaseNode>
  );
});

ResizeNodeComponent.displayName = 'ResizeNodeComponent';

export { ResizeNodeComponent };