import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const WORKFLOW_QUEUE_NAME = "canvas-workflow";

export const workflowQueue = new Queue(WORKFLOW_QUEUE_NAME, {
	connection: redisConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 1000,
		},
		removeOnComplete: true,
		removeOnFail: false,
	},
});

export interface NodeTaskJobData {
	taskId: string;
	canvasId: string;
	batchId: string;
	// The ordered list of subsequent task IDs to run after this one
	remainingTaskIds: string[];
	// Whether this specific node was explicitly selected by the user
	isExplicitlySelected: boolean;
	// Map of TaskID -> isExplicitlySelected for the remaining tasks
	selectionMap: Record<string, boolean>;
	// User API Key to use for this job
	apiKey?: string;
}
