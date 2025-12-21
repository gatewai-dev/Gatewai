import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { openai } from "../ai/openai.js";

const RunLLMPayloadSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  nodeId: z.string(),
})

export type RunLLMNodeTaskPayload = z.infer<typeof RunLLMPayloadSchema>;

export const TASK_LLM = task({
  id: "run-llm",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: RunLLMNodeTaskPayload, { ctx }) => {
    logger.log("Running LLM task", { payload, ctx });
    const result = await openai.responses.create({
      input: payload.prompt,
      model: payload.model,
    })
    return {
      result: result.output_text,
    }
  },
});