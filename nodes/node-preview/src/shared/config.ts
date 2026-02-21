import { z } from "zod";

export const PreviewNodeConfigSchema = z.object({}).strict();

export type PreviewNodeConfig = z.infer<typeof PreviewNodeConfigSchema>;

import { type NodeResult, NodeResultSchema } from "@gatewai/core/types";
export const PreviewResultSchema = NodeResultSchema;
export type PreviewResult = NodeResult;
