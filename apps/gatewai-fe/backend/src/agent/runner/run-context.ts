import { RunContext, type RunToolApprovalItem } from "@openai/agents";

class GatewaiRunContext<TContext> extends RunContext<TContext> {
	private toolLogs: Array<{
		toolName: string;
		callId: string;
		result: unknown;
	}> = [];

	/**
	 * Custom method to record the tool response.
	 */
	logToolResult(toolName: string, callId: string, result: unknown) {
		const logEntry = {
			toolName,
			callId,
			result,
			timestamp: new Date().toISOString(),
		};

		this.toolLogs.push(logEntry);

		// Actual logging - you can replace this with a logger like pino or winston
		console.log(
			`\x1b[34m[Tool Response]\x1b[0m ${toolName} (${callId}):`,
			JSON.stringify(result, null, 2),
		);
	}

	/**
	 * Optional: Accessor for stored logs
	 */
	getToolLogs() {
		return this.toolLogs;
	}

	// You can also override existing methods like approveTool to log when things are triggered
	override approveTool(
		approvalItem: RunToolApprovalItem,
		options?: { alwaysApprove?: boolean },
	) {
		console.log(
			`\x1b[32m[Approval]\x1b[0m Approving tool: ${approvalItem.toolName}`,
		);
		super.approveTool(approvalItem, options);
	}
}

export { GatewaiRunContext };
