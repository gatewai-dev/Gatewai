import { logger } from "@gatewai/core";
import { Agent, type RunContext, run, tool } from "@openai/agents";
import { z } from "zod";
import { runInSandbox } from "./sandbox.js";

/** Default max retries for code execution. */
const DEFAULT_MAX_RETRIES = 3;

/** Default VM timeout in ms. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Context passed to tool execution
 */
export interface CodeGenRunContext {
	runId: string;
}

/**
 * Options for creating a code-generation agent.
 */
export interface CodeGenAgentOptions<TResult> {
	/** Agent name shown in traces / logs. */
	name: string;
	/** The AI model to use (already wrapped via `getAgentModel`). */
	model: any;
	/** System prompt instructing the LLM how to write code. */
	systemPrompt: string;
	/** Key-value data injected as global variables in the sandbox. */
	globals?: Record<string, unknown>;
	/** Named host functions available inside the sandbox. */
	functions?: Record<string, (...args: unknown[]) => unknown>;
	/** Zod schema to validate the sandbox result. */
	resultSchema: z.ZodType<TResult>;
	/** Max code execution retries (default 3). */
	maxRetries?: number;
	/** VM wall-clock timeout in ms (default 10000). */
	timeoutMs?: number;
}

/**
 * Result store keyed by agent run ID. Each run gets its own slot
 * so concurrent runs never collide.
 */
const resultStore = new Map<string, unknown>();

/**
 * Create a code-generation agent that:
 * 1. Writes JavaScript code to produce a structured result
 * 2. Executes it in a QuickJS sandbox with injected globals/functions
 * 3. Validates the output against a Zod schema
 * 4. Retries on failure (up to maxRetries)
 * 5. Returns the validated result via submit_result
 *
 * @returns An object with `agent` (the Agent instance) and `asTool()` to wrap as a tool.
 */
export function createCodeGenAgent<TResult>(
	options: CodeGenAgentOptions<TResult>,
) {
	const {
		name,
		model,
		systemPrompt,
		globals = {},
		functions = {},
		resultSchema,
		maxRetries = DEFAULT_MAX_RETRIES,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;

	// ── Tool: execute_code ───────────────────────────────────────
	const executeCodeTool = tool({
		name: "execute_code",
		description: `Execute JavaScript code in a sandboxed VM to produce the result.

Available globals: ${Object.keys(globals).join(", ") || "(none)"}
Available functions: ${Object.keys(functions).join(", ") || "(none)"}
Also available: console.log for debugging.

Your code MUST return the result object. If the code fails validation, read the error carefully and fix only the reported issues. You have ${maxRetries} attempts total.`,
		parameters: z.object({
			code: z
				.string()
				.describe("JavaScript code to execute. Must return the result object."),
		}),
		async execute({ code }, runCtx?: RunContext<CodeGenRunContext>) {
			const runId = runCtx?.context?.runId;
			logger.info(`[${name}] execute_code invoked`);

			try {
				console.log({ code, globals, functions });
				const result = await runInSandbox({
					code,
					globals,
					functions,
					timeoutMs,
				});
				console.log({ result });
				if (!result || typeof result !== "object") {
					return "Code must return an object. Fix and retry.";
				}

				// Validate against schema
				const validation = resultSchema.safeParse(result);
				if (!validation.success) {
					const errors = validation.error.issues.map((issue) => {
						const path = issue.path.join(".") || "(root)";
						return `  • ${path}: ${issue.message}`;
					});
					console.log(
						[
							`Validation failed (${validation.error.issues.length} issue(s)):`,
							...errors,
							"",
							`Fix only the issues listed above and retry. You have ${maxRetries} attempts total.`,
						].join("\n"),
					);
					return [
						`Validation failed (${validation.error.issues.length} issue(s)):`,
						...errors,
						"",
						`Fix only the issues listed above and retry. You have ${maxRetries} attempts total.`,
					].join("\n");
				}

				// Store validated result for submit_result
				const storeKey = runId ?? "default";
				resultStore.set(storeKey, validation.data);

				return [
					"Code executed and validated successfully.",
					"",
					"Call submit_result to return the final output.",
				].join("\n");
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(`[${name}] execute_code error: ${msg}`);
				return [
					`Code execution failed: ${msg}`,
					"",
					"Common causes:",
					"  • Syntax error — check for missing brackets or semicolons.",
					"  • Undefined variable — ensure all needed globals are used correctly.",
					"  • Host function result needs JSON.parse — call JSON.parse(fnName(...args)).",
					"",
					"Fix the code and retry (make sure to return the result object).",
				].join("\n");
			}
		},
	});

	// ── Tool: submit_result ──────────────────────────────────────
	const submitResultTool = tool({
		name: "submit_result",
		description:
			"Submit the validated result. Only call after execute_code succeeds.",
		parameters: z.object({}),
		async execute(_, runCtx?: RunContext<CodeGenRunContext>) {
			const runId = runCtx?.context?.runId;
			const storeKey = runId ?? "default";
			const result = resultStore.get(storeKey);
			if (!result) {
				return "Error: No validated result found. Call execute_code first.";
			}
			// We NO LONGER delete it here to avoid race conditions
			// while runCodeGenAgent reads it out.
			return JSON.stringify(result);
		},
	});

	const agent = new Agent({
		name,
		model,
		instructions: systemPrompt,
		toolUseBehavior: { stopAtToolNames: ["submit_result"] },
		tools: [executeCodeTool, submitResultTool],
	});

	return { agent, resultStore };
}

/**
 * Standard utility to run a code generation agent to completion
 * and extract the validated result submitted via `submit_result`.
 */
export async function runCodeGenAgent<TResult>({
	agent,
	resultStore,
	prompt,
	runId = crypto.randomUUID(),
}: {
	agent: Agent<any, any>;
	resultStore: Map<string, unknown>;
	prompt: string;
	runId?: string;
}): Promise<TResult> {
	logger.info(`[${agent.name}] Starting run ${runId}`);

	// Attempt to run the agent. We inject runId as context so it's
	// available inside execute tool contexts via `getContext().runId`
	// Wait... run function takes tools that expect parameters and context.
	try {
		await run(agent, prompt, { context: { runId } });
	} catch (e) {
		logger.error({ error: e }, `[${agent.name}] Agent run threw an error`);
	}

	const finalResult = resultStore.get(runId);
	if (finalResult) {
		// We delete it here now instead of in submitResultTool
		resultStore.delete(runId);
		return finalResult as TResult;
	}

	throw new Error(
		`Agent ${agent.name} finished without a validated result in the store for runId: ${runId}`,
	);
}
