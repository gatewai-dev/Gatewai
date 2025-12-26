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

  const context = useNodeContext({nodeId: props.id})
  const nodeInputContext = useNodeInputValuesResolver({nodeId: props.id})
  console.log({nodeInputContext});

  const inputImageResult = useMemo(() => {
    if (!context?.inputHandles[0].id) {
      return null;
    }
    const imageHandleCtx = nodeInputContext[context?.inputHandles[0].id]
    const cachedValue = imageHandleCtx.cachedResultValue;
    if (cachedValue && cachedValue.data) {
      return cachedValue;
    }
    const connectedNodeValue = imageHandleCtx.resultValue;

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

  // Compute a key to detect changes in input or config
  const computeKey = useMemo(() => {
    if (!inputImageUrl) return null;
    return inputImageUrl + JSON.stringify(config, Object.keys(config).sort());
  }, [inputImageUrl, config]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Compute the blur using the processor
  useEffect(() => {
    console.log({computeKey, node})
    if (!inputImageUrl || !computeKey || !node) {
      setPreviewUrl(null);
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
      if (res.success && res.newResult) {
        const dataUrl = (res.newResult.outputs[0].items[0].data as FileData).dataUrl;
        if (dataUrl) {
          setPreviewUrl(dataUrl);
        }
      } else {
        console.error('Failed to process blur:', res.error);
      }
    };

    compute();
  }, [computeKey, node, allNodes, allEdges, allHandles, inputImageUrl, nodeInputContext, context?.inputHandles]);

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-3">
        {!inputImageUrl && <ImagePlaceholder />}
        {inputImageUrl && previewUrl && (
          <div className="w-full overflow-hidden rounded">
            <img
              src={previewUrl}
              alt="Resized preview"
              className="w-full h-full object-cover"
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