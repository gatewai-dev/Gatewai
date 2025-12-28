import type { AgentNodeConfig, FileResult } from '@gatewai/types';
import { getAllInputValuesWithHandle, getAllOutputHandles } from '../../repositories/canvas.js';
import type { NodeProcessor, NodeProcessorCtx } from './types.js';
import { aisdk } from '@openai/agents-extensions';
import { gateway } from 'ai';
import { Agent, Runner, type AgentInputItem } from '@openai/agents';
import { z, ZodObject, ZodRawShape } from 'zod';

export const FileAssetSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  bucket: z.string(),
  mimeType: z.string(),
  key: z.string(),
  signedUrl: z.string().url().nullable(),
  signedUrlExp: z.date().nullable(),
  userId: z.string(),
  isUploaded: z.boolean().default(true),
});

function CreateOutputZodSchema(outputHandles: NodeProcessorCtx["data"]["handles"]) {
  const dynamicSchema: Record<string, z.ZodTypeAny | FileResult> = {};

  const typeMap: Record<string, z.ZodTypeAny> = {
    'Text': z.string(),
    'Image': z.string(),
    'Audio': z.string(),
    'Video': z.string(),
    'File': z.string(),
  };

    let fieldSchema: ZodRawShape = {};
  for (const handle of outputHandles) {
    const outputHandleId = handle.id;
    const dataType = handle.dataTypes[0];
    let handleZodObject: ZodObject | undefined = undefined;
    if (dataType === 'File' || dataType === 'Image' || dataType === 'Audio' || dataType === 'Video') {
    handleZodObject = z.object({
            items: z.array(z.object({
                outputHandleId: z.literal(outputHandleId),
                data: z.object({
                    file: z.object({
                        entity: FileAssetSchema.optional(),
                        dataUrl: z.string().optional(),
                    }),
                }),
                type: z.literal(dataType),
            }))
        })
    }
    const content = {
        [outputHandleId]: handleZodObject
    }

    fieldSchema = {
        ...fieldSchema,
        ...content,
    }
  }

  const resultSchema = z.object(fieldSchema);
  return resultSchema;
}

const llmProcessor: NodeProcessor = async ({ node, data }) => {
    try {
     const allInputs = getAllInputValuesWithHandle(data, node.id);
     const systemPromptData = allInputs.find(input => input?.handle?.label === 'System Prompt');
     const systemPrompt = systemPromptData?.value as string | null;
     if (!systemPrompt) {
        return { success: false, error: 'System Prompt is required' };
     }
     const prompt = allInputs.find(input => input?.handle?.label === 'Instructions')?.value as string;
     if (!prompt) {
        return { success: false, error: 'Instructions is required' };
     }

     const dynamicInputs = allInputs.filter(input => {
        return input && input.handle && input.handle.id !== systemPromptData?.handle?.id && input.handle.id !== systemPromptData?.handle?.id;
     });

     type AgentContext = typeof dynamicInputs;

     const outputs = getAllOutputHandles(data, node.id);

     const jsonSchema = CreateOutputZodSchema(outputs);

     const config = node.config as unknown as AgentNodeConfig

     const agentModel = aisdk(gateway(config.model));
     const agent = new Agent<AgentContext>({
        instructions: systemPrompt,
        model: agentModel,
        name: node.name,
     })

     const runner = new Runner({
        model: agentModel,
     })

     const inputItems: AgentInputItem[] = [
        { role: 'user', content: [{type: 'input_text', text: prompt }] }
     ];

     const run = await runner.run(agent, prompt, {
        maxTurns: config.maxTurns || 10,
     });


      return { success: true, newResult };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: err?.message ?? 'LLM processing failed' };
      }
      return { success: false, error: 'LLM processing failed' };
    }
  }

  export default llmProcessor;