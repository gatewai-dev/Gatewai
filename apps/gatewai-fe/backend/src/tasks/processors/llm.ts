import { DataType } from '@gatewai/db';
import type { FileData, LLMResult } from '@gatewai/types';
import { getInputValue } from '../../repositories/canvas.js';
import type { NodeProcessor } from './types.js';
import { generateText, type ModelMessage, type TextPart, type UserContent } from 'ai';

const llmProcessor: NodeProcessor = async ({ node, data }) => {
    try {
      const systemPrompt = getInputValue(data, node.id, false, { dataType: DataType.Text, label: 'System Prompt' }) as string | null;
      const userPrompt = getInputValue(data, node.id, true, { dataType: DataType.Text, label: 'Prompt' }) as string;
      const imageFileData = getInputValue(data, node.id, false, { dataType: DataType.Image, label: 'Image' }) as FileData | null;

      // Build messages
      const messages: ModelMessage[] = [];

      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }

      const userContent: UserContent = [];

      if (userPrompt) {
        const textPart: TextPart = {
          type: 'text',
          text: userPrompt
        }
        userContent.push(textPart);
      }

      const imageData = imageFileData?.entity?.signedUrl ?? imageFileData?.dataUrl;
      if (imageData) {
        userContent.push({type: 'image', image: imageData});
      }

      if (userContent.length === 0) {
        return { success: false, error: 'No user prompt or image provided' };
      }

      messages.push({
        role: 'user',
        content:
          userContent.length === 1 && typeof userContent[0] === 'string'
            ? (userContent[0] as string)
            : userContent,
      });
      console.log({userContent})
      const result = await generateText({
        model: 'openai/gpt-5-chat',
        messages,
      });

      const outputHandle = data.handles.find(
        (h) => h.nodeId === node.id && h.type === 'Output'
      );
      if (!outputHandle) throw new Error('Output handle is missing');

      const newResult = structuredClone(node.result as unknown as LLMResult) ?? {
        outputs: [],
        selectedOutputIndex: 0,
      };
      console.log({result})
      const newGeneration: LLMResult["outputs"][number] = {
        items: [
          {
            type: DataType.Text,
            data: result.text,
            outputHandleId: outputHandle.id,
          },
        ],
      };

      newResult.outputs.push(newGeneration);
      newResult.selectedOutputIndex = newResult.outputs.length - 1;

      return { success: true, newResult };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: err?.message ?? 'LLM processing failed' };
      }
      return { success: false, error: 'LLM processing failed' };
    }
  }

  export default llmProcessor;