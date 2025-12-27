import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import type {
  TextResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById } from '@/store/nodes';
import type { TextNode } from '../node-props';
import { BaseNode } from '../base';
import { useCanvasCtx } from '../../ctx/canvas-ctx';

const TextNodeComponent = memo((props: NodeProps<TextNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));
  const { onNodeResultUpdate } = useCanvasCtx();
  const result = node?.result as unknown as TextResult;
  const text = result?.outputs?.[0]?.items?.[0]?.data ?? '';
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newResult: TextResult = {
      selectedOutputIndex: 0,
      outputs: [{
        items: [{
          outputHandleId: result?.outputs?.[0]?.items?.[0]?.outputHandleId,
          type: 'Text',
          data: e.target.value,
        }]
      }]
    };
    onNodeResultUpdate({ id: props.id, newResult });
  };

  return (
    <BaseNode {...props} className='nowheel'>
      <Textarea
        value={text}
        onChange={handleChange}
        className="w-full h-full max-h-full overflow-auto p-2 border rounded text-gray-100 resize-none text-xs!"
        placeholder="Enter text..."
      />
    </BaseNode>
  );
});
TextNodeComponent.displayName = 'TextNode';

export {
  TextNodeComponent,
};