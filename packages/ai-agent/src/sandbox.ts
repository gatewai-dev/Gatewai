import assert from "node:assert";
import { logger } from "@gatewai/core";
import { getQuickJS, type QuickJSContext, Scope } from "quickjs-emscripten";

/** Default wall-clock timeout for QuickJS VM execution. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Options for running code inside a QuickJS sandbox.
 */
export interface SandboxOptions {
	/** JavaScript code to execute inside the VM. */
	code: string;
	/** Key-value map of data injected as global variables (JSON-serialized). */
	globals?: Record<string, unknown>;
	/** Named host functions callable from inside the VM. */
	functions?: Record<string, (...args: unknown[]) => unknown>;
	/** Maximum wall-clock execution time in ms. */
	timeoutMs?: number;
}

/**
 * Run arbitrary JavaScript code inside a QuickJS sandbox.
 *
 * - Globals are injected via `JSON.parse` inside the VM
 * - Host functions are bridged to handle arg dump/dispose properly
 * - `console.log` is bridged to the host logger
 * - A hard wall-clock timeout prevents runaway code
 *
 * @returns The `dump()`-ed result of the executed code
 */
export async function runInSandbox<T = unknown>(
	options: SandboxOptions,
): Promise<T> {
	const {
		code,
		globals = {},
		functions = {},
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;

	const scope = new Scope();
	let vmContext: QuickJSContext | undefined;

	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error(`VM execution exceeded ${timeoutMs}ms timeout`)),
			timeoutMs,
		);
	});

	const executionPromise = (async () => {
		try {
			const QuickJS = await getQuickJS();
			vmContext = QuickJS.newContext();
			assert(vmContext, "QuickJS context creation failed");

			const undefinedHandle = scope.manage(vmContext.undefined);

			// ── Inject JSON globals ──────────────────────────────────
			const injectGlobal = (name: string, data: unknown): void => {
				assert(vmContext);
				const jsonHandle = scope.manage(
					vmContext.newString(JSON.stringify(data)),
				);
				const parseResult = vmContext.evalCode("JSON.parse");
				if (parseResult.error) {
					scope.manage(parseResult.error).dispose();
					throw new Error("Failed to access JSON.parse in QuickJS VM");
				}
				const parseFn = scope.manage(vmContext.unwrapResult(parseResult));
				const objHandle = scope.manage(
					vmContext.unwrapResult(
						vmContext.callFunction(parseFn, undefinedHandle, jsonHandle),
					),
				);
				vmContext.setProp(vmContext.global, name, objHandle);
			};

			for (const [name, data] of Object.entries(globals)) {
				injectGlobal(name, data);
			}

			// ── Inject host functions ────────────────────────────────
			for (const [name, fn] of Object.entries(functions)) {
				const fnHandle = scope.manage(
					vmContext.newFunction(name, (...args) => {
						assert(vmContext);
						const dumpedArgs = args.map((arg) => {
							const dumped = vmContext!.dump(arg);
							arg.dispose();
							return dumped;
						});
						const result = fn(...dumpedArgs);
						// Return the result as a JSON string that the VM can parse
						return vmContext.newString(JSON.stringify(result));
					}),
				);
				vmContext.setProp(vmContext.global, name, fnHandle);
			}

			// ── console.log bridge ───────────────────────────────────
			const consoleHandle = scope.manage(vmContext.newObject());
			const logHandle = scope.manage(
				vmContext.newFunction("log", (...args) => {
					assert(vmContext);
					const logArgs = args.map((arg) => {
						const dumped = vmContext!.dump(arg);
						arg.dispose();
						return dumped;
					});
					logger.info({ vmLog: logArgs }, "[VM]");
				}),
			);
			vmContext.setProp(consoleHandle, "log", logHandle);
			vmContext.setProp(vmContext.global, "console", consoleHandle);

			// ── Execute ──────────────────────────────────────────────
			const resultHandle = vmContext.evalCode(`(function() {\n${code}\n})()`);

			if (resultHandle.error) {
				const errorHandle = scope.manage(resultHandle.error);
				const error = vmContext.dump(errorHandle);
				const name = (error as any)?.name ?? "Error";
				const message = (error as any)?.message ?? JSON.stringify(error);
				const stack = (error as any)?.stack ?? "";
				throw new Error(`${name}: ${message}${stack ? `\n${stack}` : ""}`);
			}

			const valueHandle = scope.manage(resultHandle.value);
			return vmContext.dump(valueHandle) as T;
		} finally {
			scope.dispose();
			vmContext?.dispose();
		}
	})();

	try {
		return await Promise.race([executionPromise, timeoutPromise]);
	} finally {
		clearTimeout(timeoutId);
	}
}
