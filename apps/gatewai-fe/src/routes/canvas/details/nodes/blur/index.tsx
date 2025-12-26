import { memo, useEffect, useMemo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  type BlurNodeConfig,
  type FileData,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectAllNodes, makeSelectNodeById } from '@/store/nodes';
import { BaseNode } from '../base';
import type { BlurNode } from '../node-props';
import { makeSelectAllHandles } from '@/store/handles';
import { makeSelectAllEdges } from '@/store/edges';
import { BlurTypeSelector } from './type-selector';
import { BlurValueSlider } from './blur-slider';
import { browserNodeProcessors } from '../node-processors';
import { useNodeContext } from '../hooks/use-node-ctx';
import { useNodeInputValuesResolver } from '../hooks/use-handle-value-resolver';


const ImagePlaceholder = () => {
  return (
    <div className="w-full media-container h-[280px] flex items-center justify-center rounded">
      <span className="text-gray-400 text-sm">No image connected</span>
    </div>
  );
};

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
  const allNodes = useAppSelector(makeSelectAllNodes);
  const allHandles = useAppSelector(makeSelectAllHandles);
  const node = useAppSelector(makeSelectNodeById(props.id));
  const allEdges = useAppSelector(makeSelectAllEdges);

  const config: BlurNodeConfig = (node?.config ?? props.data.config) as BlurNodeConfig;

  const resolverArgs = useMemo(() => ({ nodeId: props.id }), [props.id]);

  const context = useNodeContext(resolverArgs)
  const nodeInputContext = useNodeInputValuesResolver(resolverArgs)
  console.log({nodeInputContext, nodeId: props.id})
  const shouldUseLocalImageData = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return false;
    }
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id]
    const cachedValue = imageHandleCtx?.cachedResultValue;
    if (cachedValue && cachedValue.data) {
      return true;
    }
    return false;
  }, [context?.inputHandles, nodeInputContext])

  const inputImageResult = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return null;
    }
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id]
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
      return fileData.entity?.signedUrl ?? fileData.dataUrl;
    };
    return null;
  }, [inputImageResult]);
  console.log({nodeInputContext, nodeid: node?.id, inputImageUrl})

  // Compute a key to detect changes in input or config
const computeKey = useMemo(() => {
  if (!context?.inputHandles[0].id) {
    return null;
  }
  if (!inputImageUrl) return null;
  let computeKey = '';
  if (shouldUseLocalImageData) {
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id]
    const cachedResult = imageHandleCtx?.cachedResult;
    const hash = cachedResult?.hash ?? '';
    console.log({hash})
    computeKey += hash;
  } else {
    computeKey += inputImageUrl;
  }
  computeKey += JSON.stringify(config, Object.keys(config).sort());
  return computeKey;
}, [context?.inputHandles, inputImageUrl, config, shouldUseLocalImageData, nodeInputContext]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Compute the blur using the processor
  useEffect(() => {
    if (!inputImageUrl || !computeKey || !node || !context?.inputHandles[0].id) {
      return;
    }

    const compute = async () => {
      const data = {
        nodes: allNodes,
        edges: allEdges,
        handles: allHandles,
      };
      const processor = browserNodeProcessors['Blur'];
      if (!processor) {
        console.error('Blur processor not found');
        return;
      }
      const res = await processor({ node, data, extraArgs: { nodeInputContextData: nodeInputContext[context?.inputHandles[0].id] } });
      console.log({res, nodeId: node?.id, })
      if (res.success && res.newResult) {
        const dataUrl = (res.newResult.outputs[0].items[0].data as FileData).dataUrl;
          console.log({nodeId: node?.id, ww: "wqe", qq: previewUrl !== dataUrl})
        if (dataUrl && previewUrl !== dataUrl) {
          setPreviewUrl(dataUrl);
        }
      } else {
        console.error('Failed to process blur:', res.error);
      }
    };

    compute();
  }, [allEdges, allHandles, allNodes, computeKey, context?.inputHandles, inputImageUrl, node, nodeInputContext, previewUrl]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!inputImageUrl && <ImagePlaceholder />}
        {inputImageUrl && previewUrl && (
          <div className="w-full overflow-hidden rounded">
            <img
              src={previewUrl}
              alt="Resized preview"
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
            />
          </div>
        )}
        {node && <div className="flex gap-3 items-end">
          <BlurTypeSelector node={node} />
          <BlurValueSlider node={node} />
        </div>}
      </div>
    </BaseNode>
  );
});

BlurNodeComponent.displayName = 'BlurNodeComponent';

export { BlurNodeComponent };