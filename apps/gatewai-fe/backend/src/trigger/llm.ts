import { logger, task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { openai } from "../ai/openai.js";
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

    const input: ResponseInput = [];

    if (payload.systemPrompt) {
      input.push({
        role: "system",
        content: payload.systemPrompt,
      })
    }

    logger.log("Running LLM task", { payload, ctx });

    const promptContent = [{ type: "input_text", text: payload.prompt }] as ResponseInputMessageContentList;
    if (payload.imageUrl) {
      const imagePart = {
        type: "input_image" as const,
        detail: "auto" as "auto" | "low" | "high",
        image_url: payload.imageUrl,
      };
      promptContent.push(imagePart);
    }

    input.push({
      role: 'user',
      content: promptContent,
    });

    const result = await openai.responses.create({
      input,
      model: payload.model,
    })
    return {
      result: result.output_text,
    }
  },
});