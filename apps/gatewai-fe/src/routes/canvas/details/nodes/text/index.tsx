import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import type {
  TextResult,
} from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { updateTextNodeValue, makeSelectNodeById } from '@/store/nodes';
import type { TextNode } from '../node-props';
import { BaseNode } from '../base';

const TextNodeComponent = memo((props: NodeProps<TextNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const dispatch = useAppDispatch();
  const result = node?.result as unknown as TextResult;
  const text = result?.outputs?.[0]?.items?.[0]?.data ?? '';
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
});
TextNodeComponent.displayName = 'TextNode';

export {
  TextNodeComponent,
};