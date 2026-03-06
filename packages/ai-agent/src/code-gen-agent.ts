import { logger } from "@gatewai/core";
import { Agent, type RunContext, run, tool } from "@openai/agents";
import { z } from "zod";
import { runInSandbox } from "./sandbox.js";

/** Default max retries for code execution. */
const DEFAULT_MAX_RETRIES = 3;

/** Default VM timeout in ms. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Context passed to tool execution.
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
	/**
	 * Optional JavaScript source injected *before* user code runs in the VM.
	 * Use this to provide helper libraries the LLM can call.
	 */
	preamble?: string;
	/** Zod schema to validate the sandbox result. */
	resultSchema: z.ZodType<TResult>;
	/** Max code execution retries (default 3). */
	maxRetries?: number;
	/** VM wall-clock timeout in ms (default 10000). */
	timeoutMs?: number;
}

/**
 * Result store keyed by agent run ID.
 *
 * Entries are cleaned up by `runCodeGenAgent` after successful retrieval,
 * OR via the TTL-based sweeper below to prevent leaks from failed runs.
 */
const resultStore = new Map<string, { value: unknown; insertedAt: number }>();

// Sweep stale entries every 5 minutes (TTL: 10 minutes)
const STORE_TTL_MS = 10 * 60 * 1_000;
setInterval(
	() => {
		const now = Date.now();
		for (const [key, entry] of resultStore) {
			if (now - entry.insertedAt > STORE_TTL_MS) {
				resultStore.delete(key);
				logger.warn(`[CodeGenAgent] Swept stale result store entry: ${key}`);
			}
		}
	},
	5 * 60 * 1_000,
).unref(); // .unref() so the timer doesn't keep the process alive

/**
 * Create a code-generation agent that:
 * 1. Writes JavaScript code to produce a structured result
 * 2. Executes it in a QuickJS sandbox with injected globals / functions / preamble
 * 3. Validates the output against a Zod schema
 * 4. Retries on failure (up to maxRetries)
 * 5. Returns the validated result via `submit_result`
 *
 * @returns An object with `agent` (the Agent instance) and `resultStore`.
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
		preamble,
		resultSchema,
		maxRetries = DEFAULT_MAX_RETRIES,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;

	const globalNames = Object.keys(globals);
	const functionNames = Object.keys(functions);
	const hasPreamble = !!preamble;

	// ── Tool: execute_code ────────────────────────────────────────────────────
	const executeCodeTool = tool({
		name: "execute_code",
		description: [
			"Execute JavaScript code in a sandboxed VM to compute the result.",
			"",
			hasPreamble
				? "A helper library is pre-loaded — all its functions are already global."
				: "",
			globalNames.length
				? `Available globals (already parsed, access directly): ${globalNames.join(", ")}`
				: "",
			functionNames.length
				? [
						`Available host functions (call like normal JS — returns are plain objects, NOT JSON strings):`,
						functionNames.map((n) => `  • ${n}(...args)`).join("\n"),
					].join("\n")
				: "",
			"Also available: console.log for debugging.",
			"",
			"Your code MUST return the result object as the last expression.",
			"Example:  return { foo: 'bar' };",
			"",
			`If validation fails, read ONLY the listed issues and fix them. You have ${maxRetries} attempts total.`,
			"",
			"Common mistakes to avoid:",
			"  • Do NOT call JSON.parse() on host function return values — they are already objects.",
			"  • Do NOT use ES module syntax (import/export) — the sandbox does not support it.",
			"  • Do NOT use async/await — the sandbox is synchronous.",
		]
			.filter(Boolean)
			.join("\n"),
		parameters: z.object({
			code: z
				.string()
				.describe("JavaScript code to execute. Must return the result object."),
		}),
		async execute({ code }, runCtx?: RunContext<CodeGenRunContext>) {
			const runId = runCtx?.context?.runId ?? "default";
			logger.info(`[${name}] execute_code called (runId=${runId})`);

			try {
				const result = await runInSandbox({
					code,
					globals,
					functions,
					preamble,
					timeoutMs,
				});

				if (
					result === null ||
					result === undefined ||
					typeof result !== "object"
				) {
					return [
						"Code must return an object. Got: " + JSON.stringify(result),
						"",
						"Make sure your code ends with:  return { ... };",
					].join("\n");
				}

				const validation = resultSchema.safeParse(result);
				if (!validation.success) {
					const issues = validation.error.issues.map((issue) => {
						const path = issue.path.join(".") || "(root)";
						return `  • ${path}: ${issue.message}`;
					});
					return [
						`Validation failed (${issues.length} issue(s)):`,
						...issues,
						"",
						`Fix ONLY the issues above. Attempts remaining: ${maxRetries}.`,
					].join("\n");
				}

				resultStore.set(runId, {
					value: validation.data,
					insertedAt: Date.now(),
				});

				return [
					"✓ Code executed and validated successfully.",
					"Call submit_result to finalise.",
				].join("\n");
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(`[${name}] execute_code error: ${msg}`);
				return [
					`Code execution failed: ${msg}`,
					"",
					"Debugging tips:",
					"  • Syntax error  → check for missing brackets, quotes, or semicolons.",
					"  • ReferenceError → the variable/function you referenced is not in scope.",
					"  • Host functions return plain objects — do NOT JSON.parse() them.",
					"  • Your code must end with  return { ... };",
					"",
					"Fix and retry.",
				].join("\n");
			}
		},
	});

	// ── Tool: submit_result ───────────────────────────────────────────────────
	const submitResultTool = tool({
		name: "submit_result",
		description:
			"Finalise the run by submitting the validated result. " +
			"Only call this after execute_code reports success.",
		parameters: z.object({}),
		async execute(_, runCtx?: RunContext<CodeGenRunContext>) {
			const runId = runCtx?.context?.runId ?? "default";
			const entry = resultStore.get(runId);
			if (!entry) {
				return "Error: no validated result found. Call execute_code first.";
			}
			// Return the stored value as a JSON string so the agent can confirm it.
			// The actual typed value is retrieved by runCodeGenAgent after the run.
			return JSON.stringify(entry.value);
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
 * Run a code-generation agent to completion and return the validated result
 * that was stored via `submit_result`.
 *
 * Throws if the agent finishes without storing a result (e.g. all retries
 * exhausted or the model gave up).
 */
export async function runCodeGenAgent<TResult>({
	agent,
	resultStore,
	prompt,
	runId = crypto.randomUUID(),
}: {
	agent: Agent<any, any>;
	resultStore: Map<string, { value: unknown; insertedAt: number }>;
	prompt: string;
	runId?: string;
}): Promise<TResult> {
	logger.info(`[${agent.name}] Starting run (runId=${runId})`);

	try {
		await run(agent, prompt, { context: { runId } });
	} catch (e) {
		// Log but continue — the agent may have stored a result before throwing.
		logger.error({ error: e }, `[${agent.name}] Agent run threw an error`);
	}

	const entry = resultStore.get(runId);
	if (entry) {
		resultStore.delete(runId);
		return entry.value as TResult;
	}

	throw new Error(
		`[${agent.name}] Run completed without a validated result (runId=${runId}). ` +
			`The model may have exhausted retries or failed to call submit_result.`,
	);
}
