
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './base';
import { Textarea } from '@/components/ui/textarea';
import type {
  LLMResult,
  GPTImage1Result,
} from '@gatewai/types';
import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useCanvasCtx } from '../ctx/canvas-ctx';
import { MediaContent } from './media-content';
import type { TextNode, FileNode, LLMNode, GPTImage1Node } from './node-props';
import { useAppDispatch, useAppSelector } from '@/store';
import { updateTextNodeValue } from '@/store/nodes';

// Text Node
const TextNodeComponent = (props: NodeProps<TextNode>) => {
  const st = useAppSelector(state => state);
  console.log(st)
  const node = useAppSelector(state => state.nodes.entities[props.id]);
  console.log({node, id: props.id})
  const dispatch = useAppDispatch();
  const result = node?.result as LLMResult;
  console.log({result});
  if (!result) {
    return (
      <BaseNode {...props}>
        <div className="text-gray-500">No text</div>
      </BaseNode>
    );
  }
  const text = result.parts[0].data;
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(updateTextNodeValue({ id: props.id, value: e.target.value }));
  };

  return (
    <BaseNode {...props}>
      <Textarea
        value={text}
        onChange={handleChange}
        className="w-full h-full max-h-full overflow-auto p-2 border rounded text-gray-100 resize-none text-xs!"
        placeholder="Enter text..."
      />
    </BaseNode>
  );
}
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


// Text Node
const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {
  const result = props.data?.result as LLMResult || '';
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

const GPTImage1NodeComponent = memo((props: NodeProps<GPTImage1Node>) => {
  const { runNodes } = useCanvasCtx();
  const result = props.data?.result as GPTImage1Result || '';
  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2 items-end'>
        <MediaContent node={props} result={result} onChangeSelection={console.log} />
        <Button onClick={() => runNodes([props.data.id])} variant="secondary" size="xs" type='button'><PlayIcon /><span className='text-xs'>Run Model</span></Button>
      </div>
    </BaseNode>
  );
});
GPTImage1NodeComponent.displayName = 'GPTIMage1Node';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  File: FileNodeComponent,
  Text: TextNodeComponent,
  GPTImage1: GPTImage1NodeComponent
};

// Export components
export {
  nodeTypes,
  LlmNodeComponent,
  TextNodeComponent,
  FileNodeComponent ,
  GPTImage1NodeComponent,
};