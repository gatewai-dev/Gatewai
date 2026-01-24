import type { JsonPatchOp } from "@gatewai/types";
import fastjsonpatch from "fast-json-patch";

/**
 * Fields that should never be included in patches (database-managed)
 */
const FORBIDDEN_FIELDS = [
	"createdAt",
	"updatedAt",
	"template",
	"canvasId",
	"originalNodeId",
];

/**
 * Fields that are typically auto-managed and shouldn't be patched unless explicit
 */
const AUTO_MANAGED_FIELDS = [
	"zIndex",
	"height", // Unless explicitly changing layout
];

/**
 * Validates and cleans a JSON patch array
 * Removes unnecessary operations and validates structure
 */
export function validateAndCleanPatch(patch: JsonPatchOp[]): {
	valid: boolean;
	cleaned: JsonPatchOp[];
	warnings: string[];
	errors: string[];
} {
	const warnings: string[] = [];
	const errors: string[] = [];
	const cleaned: JsonPatchOp[] = [];

	for (const op of patch) {
		// Check for forbidden fields
		const isForbidden = FORBIDDEN_FIELDS.some((field) =>
			op.path.includes(`/${field}`),
		);

		if (isForbidden) {
			warnings.push(`Skipped forbidden field operation: ${op.path}`);
			continue;
		}

		// Check for auto-managed fields (warn but allow)
		const isAutoManaged = AUTO_MANAGED_FIELDS.some((field) =>
			op.path.includes(`/${field}`),
		);

		if (isAutoManaged) {
			warnings.push(`Operation on auto-managed field: ${op.path}`);
		}

		// Validate operation type
		if (op.op === "add") {
			if (!op.value) {
				errors.push(`ADD operation missing value: ${op.path}`);
				continue;
			}
			cleaned.push(op);
		} else if (op.op === "remove") {
			cleaned.push(op);
		} else if (op.op === "replace") {
			if (op.value === undefined) {
				errors.push(`REPLACE operation missing value: ${op.path}`);
				continue;
			}
			cleaned.push(op);
		} else if (op.op === "move" || op.op === "copy") {
			if (!("from" in op) || !op.from) {
				errors.push(
					`${op.op.toUpperCase()} operation missing 'from': ${op.path}`,
				);
				continue;
			}
			cleaned.push(op);
		} else if (op.op === "test") {
			// Test operations are allowed
			cleaned.push(op);
		}
	}

	return {
		valid: errors.length === 0,
		cleaned,
		warnings,
		errors,
	};
}

/**
 * Optimizes a patch by removing redundant operations
 */
export function optimizePatch(patch: JsonPatchOp[]): JsonPatchOp[] {
	const pathOperations = new Map<string, JsonPatchOp>();

	// Last operation wins for same path (except add to arrays)
	for (const op of patch) {
		const key = op.path;

		// For array appends, keep all
		if (op.path.endsWith("/-")) {
			continue;
		}

		pathOperations.set(key, op);
	}

	return Array.from(pathOperations.values());
}

/**
 * Simplifies patches that remove and immediately re-add
 */
export function simplifyPatch(patch: JsonPatchOp[]): JsonPatchOp[] {
	const simplified: JsonPatchOp[] = [];
	const removeMap = new Map<string, number>();

	// First pass: identify remove operations
	patch.forEach((op, index) => {
		if (op.op === "remove") {
			removeMap.set(op.path, index);
		}
	});

	// Second pass: check if removes are followed by adds
	for (let i = 0; i < patch.length; i++) {
		const op = patch[i];

		if (op.op === "remove") {
			// Check if next operation is an add to same path
			const nextOp = patch[i + 1];
			if (nextOp && nextOp.op === "add" && nextOp.path === op.path) {
				// Convert to replace
				simplified.push({
					op: "replace",
					path: op.path,
					value: nextOp.value,
				});
				i++; // Skip next operation
				continue;
			}
		}

		simplified.push(op);
	}

	return simplified;
}

/**
 * Full patch cleanup pipeline
 */
export function cleanupPatch(patch: JsonPatchOp[]): {
	patch: JsonPatchOp[];
	warnings: string[];
	errors: string[];
} {
	const { valid, cleaned, warnings, errors } = validateAndCleanPatch(patch);

	if (!valid) {
		return { patch: [], warnings, errors };
	}

	const simplified = simplifyPatch(cleaned);
	const optimized = optimizePatch(simplified);

	return {
		patch: optimized,
		warnings,
		errors,
	};
}

export function applyJsonPatch<T>(document: T, patch: JsonPatchOp[]): T {
	const result = fastjsonpatch.applyPatch(
		document as any,
		patch as fastjsonpatch.Operation[],
		true, // validate
		false, // mutate (we want a new object if possible, but fast-json-patch mutates by default if mutate is true)
	);
	return result.newDocument;
}
