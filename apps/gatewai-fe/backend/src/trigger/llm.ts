import { logger, task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { generateText } from 'ai';
import type { ResponseInput, ResponseInputMessageContentList } from "openai/resources/responses/responses.mjs";

export const RunLLMPayloadSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  imageUrl: z.string().optional(),
  nodeId: z.string(),
})

export type RunLLMNodeTaskPayload = z.infer<typeof RunLLMPayloadSchema>;

export const TASK_LLM = task({
  id: "run-llm",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: RunLLMNodeTaskPayload, { ctx }) => {

    return {
      result: 'Mock LLM Response',
    }

    const result = await generateText({
      prompt: payload.prompt,
      system: payload.systemPrompt ?? undefined,
      model: payload.model,
    })
    return {
      result: result.text,
    }
  },
});