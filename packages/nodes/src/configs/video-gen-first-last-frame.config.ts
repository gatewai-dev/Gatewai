import { z } from "zod";
import { VideoGenBaseSchema } from "./google.videogen.base.config.js";

export const VideoGenFirstLastFrameNodeConfigSchema = VideoGenBaseSchema.extend(
	{
		durationSeconds: z.literal("8"),
	},
).strict();

export type VideoGenFirstLastFrameNodeConfig = z.infer<
	typeof VideoGenFirstLastFrameNodeConfigSchema
>;
