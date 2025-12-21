import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const RunTaskPayloadSchema = z.object({
  taskIds: z.array(z.string()),
  canvasId: z.string(),
  userId: z.string(),
})

export type RunCanvasTaskPayload = z.infer<typeof RunTaskPayloadSchema>;

export const helloWorldTask = task({
  id: "hello-world",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: RunCanvasTaskPayload, { ctx }) => {
    logger.log("Hello, world!", { payload, ctx });

    await wait.for({ seconds: 5 });

    return {
      message: "Hello, world!",
    }
  },
});