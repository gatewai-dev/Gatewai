
import { memo, useCallback, useEffect } from 'react';
import { useReactFlow, type NodeProps, type Node } from '@xyflow/react';
import * as PIXI from 'pixi.js';
import { useApplication } from '@pixi/react';
import { BaseNode } from './base';
import { Textarea } from '@/components/ui/textarea';
import type {
  AgentNodeData,
  ArrayNodeData,
  BlurNodeData,
  CompositorNodeData,
  DescriberNodeData,
  FileNodeData,
  GroupNodeData,
  CrawlerNodeData,
  MaskNodeData,
  NodeWithFileType,
  PainterNodeData,
  ResizeNodeData,
  RouterNodeData,
  LLMNodeData,
  TextNodeData,
  ThreeDNodeData,
  LLMResult,
  GPTImage1Result,
} from '@gatewai/types';
import { PixiApplication } from './pixi-app';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useCanvasCtx } from '../ctx/canvas-ctx';

// Define typed node components
export type TextNode = Node<NodeWithFileType<TextNodeData>, 'Text'>;
export type LLMNode = Node<NodeWithFileType<LLMNodeData>, 'LLM'>;
export type FileNode = Node<NodeWithFileType<FileNodeData>, 'File'>;
export type CrawlerNode = Node<NodeWithFileType<CrawlerNodeData>, 'Crawler'>;
export type GroupNode = Node<NodeWithFileType<GroupNodeData>, 'Group'>;
export type AgentNode = Node<NodeWithFileType<AgentNodeData>, 'Agent'>;
export type ThreeDNode = Node<NodeWithFileType<ThreeDNodeData>, 'ThreeD'>;
export type MaskNode = Node<NodeWithFileType<MaskNodeData>, 'Mask'>;
export type PainterNode = Node<NodeWithFileType<PainterNodeData>, 'Painter'>;
export type BlurNode = Node<NodeWithFileType<BlurNodeData>, 'Blur'>;
export type CompositorNode = Node<NodeWithFileType<CompositorNodeData>, 'Compositor'>;
export type DescriberNode = Node<NodeWithFileType<DescriberNodeData>, 'Describer'>;
export type RouterNode = Node<NodeWithFileType<RouterNodeData>, 'Router'>;
export type ArrayNode = Node<NodeWithFileType<ArrayNodeData>, 'Array'>;
export type ResizeNode = Node<NodeWithFileType<ResizeNodeData>, 'Resize'>;


// Common Preview Component for Image Processing Nodes
const ImagePreview = memo(({ nodeId }: { nodeId: string }) => {
  const { app } = useApplication();
  const { getEdges, getNode } = useReactFlow();

  useEffect(() => {
    app.stage.removeChildren();
    const node = getNode(nodeId);
    if (!node) return;

    const edges = getEdges();
    const inputEdges = edges
      .filter((e) => e.target === nodeId)
      .sort((a, b) => (a.targetHandle || '').localeCompare(b.targetHandle || ''));

    const loadInputs = async () => {
      const inputSprites: PIXI.Sprite[] = [];
      if (inputEdges.length === 0) {
        if (!node.data?.fileData?.url) return;
        const texture = await PIXI.Assets.load(node.data.fileData.url);
        const sprite = new PIXI.Sprite(texture);
        sprite.width = app.screen.width;
        sprite.height = app.screen.height;
        inputSprites.push(sprite);
      } else {
        for (const edge of inputEdges) {
          const inputNode = getNode(edge.source);
          if (!inputNode || !inputNode.data?.fileData?.url) continue;

          const texture = await PIXI.Assets.load(inputNode.data.fileData.url);
          const sprite = new PIXI.Sprite(texture);
          sprite.width = app.screen.width;
          sprite.height = app.screen.height;
          inputSprites.push(sprite);
        }
      }

      if (inputSprites.length === 0) return;

      const container = new PIXI.Container();
      switch (node.type) {
        case 'Preview':
          container.addChild(inputSprites[0]);
          break;
        case 'Blur': {
          const blurFilter = new PIXI.BlurFilter({
            strength: (node.data.data as BlurNodeData)?.size || 1,
          });
          inputSprites[0].filters = [blurFilter];
          container.addChild(inputSprites[0]);
          break;
        }
        case 'Mask':
          if (inputSprites.length >= 2) {
            inputSprites[0].mask = inputSprites[1];
            container.addChild(inputSprites[0]);
            container.addChild(inputSprites[1]);
          } else {
            container.addChild(inputSprites[0]);
          }
          break;
        case 'Resize': {
          const resizeData = node.data.data as ResizeNodeData;
          inputSprites[0].width = resizeData?.width || 1024;
          inputSprites[0].height = resizeData?.height || 1024;
          container.addChild(inputSprites[0]);
          break;
        }
        case 'Painter': {
          const painterData = node.data.data as PainterNodeData;
          const graphics = new PIXI.Graphics();
          graphics
            .circle(
              app.screen.width / 2,
              app.screen.height / 2,
              (painterData?.size || 10) / 2
            )
            .fill(painterData?.color || 0x000000);
          container.addChild(inputSprites[0]);
          container.addChild(graphics);

          const onPointerDown = (event: PIXI.FederatedPointerEvent) => {
            graphics
              .circle(event.global.x, event.global.y, (painterData?.size || 10) / 2)
              .fill(painterData?.color || 0x000000);
          };
          app.stage.interactive = true;
          app.stage.on('pointerdown', onPointerDown);
          return () => app.stage.off('pointerdown', onPointerDown);
        }
        case 'Compositor':
          inputSprites.forEach((sprite) => container.addChild(sprite));
          break;
        default:
          container.addChild(inputSprites[0]);
      }
      app.stage.addChild(container);
    };
    loadInputs();
  }, [app, nodeId, getEdges, getNode]);

  return null;
});

// Text Node
const TextNodeComponent = memo((props: NodeProps<TextNode>) => {
  const { updateNodeCustomData } = useCanvasCtx();
  const content = props.data?.data?.content || '';
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeCustomData((props.id), {...props.data, content: e.target.value});
  };

  return (
    <BaseNode {...props}>
      <Textarea
        value={content}
        onChange={handleChange}
        className="w-full h-full max-h-full overflow-auto p-2 border rounded text-gray-100 resize-none text-xs!"
        placeholder="Enter text..."
      />
    </BaseNode>
  );
});
TextNodeComponent.displayName = 'TextNode';

// File Node
const FileNodeComponent = memo((props: NodeProps<FileNode>) => {
  return (
    <BaseNode {...props}>
      {props.data?.fileData?.url ? (
        <a href={props.data.fileData.url} className="text-blue-500 hover:underline">
          {props.data.fileData.name || 'Download file'}
        </a>
      ) : (
        <div className="text-gray-500">No file</div>
      )}
    </BaseNode>
  );
});
FileNodeComponent.displayName = 'FileNode';

// Crawler Node
const CrawlerNodeComponent = memo((props: NodeProps<CrawlerNode>) => {
  return (
    <BaseNode {...props}>
      {props.data?.data?.url ? (
        <a href={props.data.data.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          {props.data.data.url}
        </a>
      ) : (
        <div className="text-gray-500">No link</div>
      )}
    </BaseNode>
  );
});
CrawlerNodeComponent.displayName = 'CrawlerNode';


// Text Node
const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const result = props.data?.data.result as LLMResult || '';
  const text = result.parts[0].data;
  const { runNodes } = useCanvasCtx();
  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        <p
          className="w-full text-xs min-h-[200px] max-h-full nowheel overflow-auto p-2 border rounded text-gray-100 resize-none"
        >
          {text}
        </p>
        <Button onClick={() => runNodes([props.data.id])} variant="secondary" size="xs" type='button'><PlayIcon /><span className='text-xs'>Run Model</span></Button>
      </div>
    </BaseNode>
  );
});
LlmNodeComponent.displayName = 'LLMNode';

const GPTImage1NodeComponent = memo((props: NodeProps<LLMNode>) => {
  const result = props.data?.data.result as GPTImage1Result || '';
  const parts = result.parts;
  const { runNodes } = useCanvasCtx();
  const selectedPart = parts[result.selectedIndex];

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        <div className='relative h-full w-full'>
          <div className='absolute top-2 left-2 p-1 bg-black/10 rounded text-[8px]'>
            {result.selectedIndex + 1} / {parts.length}
          </div>
          <img src={selectedPart.data.url} alt={selectedPart.data.name} className='w-full h-full' />
        </div>
        <Button onClick={() => runNodes([props.data.id])} variant="secondary" size="xs" type='button'><PlayIcon /><span className='text-xs'>Run Model</span></Button>
      </div>
    </BaseNode>
  );
});
GPTImage1NodeComponent.displayName = 'GPTIMage1Node';

// Group Node
const GroupNodeComponent = memo((props: NodeProps<GroupNode>) => {
  return (
    <BaseNode {...props}>
      <div className="text-gray-600">Group container</div>
    </BaseNode>
  );
});
GroupNodeComponent.displayName = 'GroupNode';

// Agent Node
const AgentNodeComponent = memo((props: NodeProps<AgentNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const prompt = props.data?.data?.prompt || '';

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateData({ prompt: e.target.value });
  };

  return (
    <BaseNode {...props}>
      <Textarea
        value={prompt}
        onChange={handleChange}
        className="w-full h-24 p-2 border rounded text-gray-600 resize-none"
        placeholder="Enter AI prompt..."
      />
    </BaseNode>
  );
});
AgentNodeComponent.displayName = 'AgentNode';

// ThreeD Node
const ThreeDNodeComponent = memo((props: NodeProps<ThreeDNode>) => {
  return (
    <BaseNode {...props}>
      {props.data?.fileData?.url ? (
        <div className="text-gray-600">
          3D Model: <a href={props.data.fileData.url}>View</a>
        </div>
      ) : (
        <div className="text-gray-500">No 3D model</div>
      )}
    </BaseNode>
  );
});
ThreeDNodeComponent.displayName = 'ThreeDNode';

// Mask Node
const MaskNodeComponent = memo((props: NodeProps<MaskNode>) => {
  return (
    <BaseNode {...props}>
      <div className="text-gray-600">Mask settings</div>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
    </BaseNode>
  );
});
MaskNodeComponent.displayName = 'MaskNode';

// Painter Node
const PainterNodeComponent = memo((props: NodeProps<PainterNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const color = props.data?.data?.color || '#594949';
  const size = props.data?.data?.size || 100;
  const bgColor = props.data?.data?.bgColor || '#000000';

  return (
    <BaseNode {...props}>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
      <div className="flex flex-col gap-2">
        <div className="flex items-center">
          <label className="text-xs mr-2">Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => updateData({ color: e.target.value })}
            className="w-6 h-6"
          />
          <span className="ml-2 text-xs">{color}</span>
        </div>
        <div className="flex items-center">
          <label className="text-xs mr-2">Size:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={size}
            onChange={(e) => updateData({ size: parseInt(e.target.value) })}
            className="flex-1"
          />
          <span className="ml-2 text-xs">{size}%</span>
        </div>
        <div className="flex items-center">
          <label className="text-xs mr-2">Background Color:</label>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => updateData({ bgColor: e.target.value })}
            className="w-6 h-6"
          />
        </div>
      </div>
    </BaseNode>
  );
});
PainterNodeComponent.displayName = 'PainterNode';

// Blur Node
const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const blurType = props.data?.data?.blurType || 'Gaussian';
  const size = props.data?.data?.size || 1;

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center">
          <label className="text-xs mr-2">Type:</label>
          <select
            value={blurType}
            onChange={(e) => updateData({ blurType: e.target.value })}
            className="border rounded text-xs p-1"
          >
            <option>Gaussian</option>
            <option>Box</option>
            <option>Motion</option>
          </select>
        </div>
        <div className="flex items-center">
          <label className="text-xs mr-2">Size:</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={size}
            onChange={(e) => updateData({ size: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="ml-2 text-xs">{size}</span>
        </div>
      </div>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
    </BaseNode>
  );
});
BlurNodeComponent.displayName = 'BlurNode';

// Compositor Node
const CompositorNodeComponent = memo((props: NodeProps<CompositorNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const layers = props.data?.data?.layerUpdates || [];

  const addLayer = () => {
    updateData({
      layerUpdates: [...layers, { id: Date.now(), name: 'New Layer' }],
    });
  };

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-2">
        <button
          onClick={addLayer}
          className="bg-blue-500 text-white text-xs px-2 py-1 rounded"
        >
          Add another layer
        </button>
        {layers.map((layer: { id: number; name: string }) => (
          <div key={layer.id} className="flex items-center justify-between">
            <span className="text-xs">{layer.name}</span>
            <button className="text-xs text-blue-500">Edit</button>
          </div>
        ))}
      </div>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
    </BaseNode>
  );
});
CompositorNodeComponent.displayName = 'CompositorNode';

// Describer Node
const DescriberNodeComponent = memo((props: NodeProps<DescriberNode>) => {
  return (
    <BaseNode {...props}>
      <div className="text-gray-600">{props.data?.data?.text || 'Description output'}</div>
    </BaseNode>
  );
});
DescriberNodeComponent.displayName = 'DescriberNode';

// Router Node
const RouterNodeComponent = memo((props: NodeProps<RouterNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const invert = props.data?.data?.invert || false;

  const toggleInvert = () => {
    updateData({ invert: !invert });
  };

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-2">
        <button
          onClick={toggleInvert}
          className={`text-xs px-2 py-1 rounded ${
            invert ? 'bg-red-500 text-white' : 'bg-gray-200'
          }`}
        >
          Invert
        </button>
      </div>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
    </BaseNode>
  );
});
RouterNodeComponent.displayName = 'RouterNode';

// Array Node
const ArrayNodeComponent = memo((props: NodeProps<ArrayNode>) => {
  return (
    <BaseNode {...props}>
      <div className="text-gray-600">Array items</div>
    </BaseNode>
  );
});
ArrayNodeComponent.displayName = 'ArrayNode';

// Resize Node
const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
  const updateData = useUpdateNodeData(props.id);
  const width = props.data?.data?.width || 512;
  const height = props.data?.data?.height || 512;

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center">
          <label className="text-xs mr-2">W:</label>
          <input
            type="number"
            value={width}
            onChange={(e) => updateData({ width: parseInt(e.target.value) })}
            className="border rounded text-xs p-1 w-16"
          />
        </div>
        <div className="flex items-center">
          <label className="text-xs mr-2">H:</label>
          <input
            type="number"
            value={height}
            onChange={(e) => updateData({ height: parseInt(e.target.value) })}
            className="border rounded text-xs p-1 w-16"
          />
        </div>
      </div>
      <PixiApplication className="w-[200px] h-[200px]">
        <ImagePreview nodeId={props.id} />
      </PixiApplication>
    </BaseNode>
  );
});
ResizeNodeComponent.displayName = 'ResizeNode';

// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Agent: AgentNodeComponent,
  Array: ArrayNodeComponent,
  Blur: BlurNodeComponent,
  Compositor: CompositorNodeComponent,
  Describer: DescriberNodeComponent,
  File: FileNodeComponent,
  Group: GroupNodeComponent,
  Crawler: CrawlerNodeComponent,
  Mask: MaskNodeComponent,
  Painter: PainterNodeComponent,
  Resize: ResizeNodeComponent,
  Router: RouterNodeComponent,
  Text: TextNodeComponent,
  ThreeD: ThreeDNodeComponent,
  GPTImage1: GPTImage1NodeComponent
};

// Export components
export {
  nodeTypes,
  LlmNodeComponent,
  TextNodeComponent,
  FileNodeComponent ,
  CrawlerNodeComponent ,
  GroupNodeComponent,
  AgentNodeComponent ,
  ThreeDNodeComponent ,
  MaskNodeComponent ,
  PainterNodeComponent ,
  BlurNodeComponent ,
  CompositorNodeComponent ,
  DescriberNodeComponent ,
  GPTImage1NodeComponent,
  RouterNodeComponent,
  ArrayNodeComponent ,
  ResizeNodeComponent,
};