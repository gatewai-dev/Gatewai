import { z } from "zod";
import { VIDEOGEN_DURATIONS, VideoGenBaseSchema } from "./google.videogen.base.config.js";

export const VideoGenNodeConfigSchema = VideoGenBaseSchema.extend({
	durationSeconds: z.enum(VIDEOGEN_DURATIONS).default("8"),
})
	.strict()
	.refine(
		(data) => !(data.resolution === "1080p" && data.durationSeconds !== "8"),
		{
			message: "1080p resolution only supports 8s duration",
			path: ["resolution"],
		},
	);

export type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;
