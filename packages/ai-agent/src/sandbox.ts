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
	/**
	 * Key-value map of data injected as global variables (JSON-serialized).
	 * Available inside the VM under their key names.
	 */
	globals?: Record<string, unknown>;
	/**
	 * Named host functions callable from inside the VM.
	 *
	 * IMPORTANT: These are bridged synchronously across the host ↔ VM boundary.
	 * Arguments and return values are automatically JSON-serialised/deserialised,
	 * so the VM sees plain JS objects — no manual JSON.parse() needed.
	 */
	functions?: Record<string, (...args: unknown[]) => unknown>;
	/**
	 * Optional JavaScript code injected *before* user code runs.
	 * Use this to inject helper libraries, polyfills, or shared utilities.
	 */
	preamble?: string;
	/** Maximum wall-clock execution time in ms. */
	timeoutMs?: number;
}

/**
 * Run arbitrary JavaScript code inside a QuickJS sandbox.
 *
 * Key design decisions:
 *
 * 1. **Transparent function bridge** — host functions are automatically
 *    wrapped so their return values arrive as real JS objects inside the VM.
 *    VM code can call `hostFn(arg)` directly without `JSON.parse`.
 *
 * 2. **Preamble support** — helper libraries are eval'd first, making all
 *    their exports available as top-level globals for user code.
 *
 * 3. **Structured error extraction** — VM errors are reported with name,
 *    message, and stack to aid LLM debugging.
 *
 * 4. **Single Scope** — all handles are tracked in one scope; `.dispose()`
 *    in the finally block prevents QuickJS memory leaks.
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
		preamble,
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

			const vm = vmContext; // narrow to non-undefined for closures

			// ── console.log bridge ───────────────────────────────────────────
			{
				const consoleHandle = scope.manage(vm.newObject());
				const logHandle = scope.manage(
					vm.newFunction("log", (...args) => {
						const values = args.map((h) => {
							const v = vm.dump(h);
							h.dispose();
							return v;
						});
						logger.info({ vmLog: values }, "[VM]");
					}),
				);
				vm.setProp(consoleHandle, "log", logHandle);
				vm.setProp(vm.global, "console", consoleHandle);
			}

			// ── Inject JSON globals ──────────────────────────────────────────
			// Evaluate JSON.parse once and reuse to avoid repeated lookups.
			const jsonParseHandle = scope.manage(
				vm.unwrapResult(vm.evalCode("JSON.parse")),
			);
			const undefinedHandle = scope.manage(vm.undefined);

			const setGlobal = (name: string, data: unknown): void => {
				const jsonStr = scope.manage(vm.newString(JSON.stringify(data)));
				const objHandle = scope.manage(
					vm.unwrapResult(
						vm.callFunction(jsonParseHandle, undefinedHandle, jsonStr),
					),
				);
				vm.setProp(vm.global, name, objHandle);
			};

			for (const [name, value] of Object.entries(globals)) {
				setGlobal(name, value);
			}

			// ── Inject host functions (transparent bridge) ───────────────────
			//
			// The bridge serialises args → host, calls the fn, then deserialises
			// the return value back into the VM.  User code in the VM treats these
			// as regular functions returning plain objects — no JSON.parse needed.
			for (const [name, fn] of Object.entries(functions)) {
				const fnHandle = scope.manage(
					vm.newFunction(name, (...vmArgs) => {
						// Dump VM handles → JS values, then dispose the handles
						const hostArgs = vmArgs.map((h) => {
							const v = vm.dump(h);
							h.dispose();
							return v;
						});

						let result: unknown;
						try {
							result = fn(...hostArgs);
						} catch (hostErr) {
							const msg =
								hostErr instanceof Error ? hostErr.message : String(hostErr);
							// Return an error object the VM can inspect
							return vm.newString(
								JSON.stringify({ __hostError: true, message: msg }),
							);
						}

						// Re-hydrate result as a proper VM object via JSON round-trip
						const jsonStr = scope.manage(
							vm.newString(JSON.stringify(result ?? null)),
						);
						return vm.unwrapResult(
							vm.callFunction(jsonParseHandle, undefinedHandle, jsonStr),
						);
					}),
				);
				vm.setProp(vm.global, name, fnHandle);
			}

			// ── Run preamble (helper library) ────────────────────────────────
			if (preamble) {
				const preambleResult = vm.evalCode(preamble, "preamble.js");
				if (preambleResult.error) {
					const err = scope.manage(preambleResult.error);
					const dumped = vm.dump(err) as any;
					throw new Error(
						`Preamble evaluation failed: ${dumped?.message ?? JSON.stringify(dumped)}`,
					);
				}
				scope.manage(preambleResult.value).dispose();
			}

			// ── Execute user code ────────────────────────────────────────────
			const wrappedCode = `(function() {\n${code}\n})()`;
			const resultHandle = vm.evalCode(wrappedCode, "userCode.js");

			if (resultHandle.error) {
				const errorHandle = scope.manage(resultHandle.error);
				const error = vm.dump(errorHandle) as any;
				const name = error?.name ?? "Error";
				const message = error?.message ?? JSON.stringify(error);
				const stack = error?.stack ? `\n${error.stack}` : "";
				throw new Error(`${name}: ${message}${stack}`);
			}

			const valueHandle = scope.manage(resultHandle.value);
			return vm.dump(valueHandle) as T;
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
