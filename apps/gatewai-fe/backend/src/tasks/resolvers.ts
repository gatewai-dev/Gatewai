import assert from "node:assert";
import { type DataType, prisma } from "@gatewai/db";
import type { FileData, NodeResult } from "@gatewai/types";
import { add } from "date-fns";
import type { CanvasCtxDataWithTasks } from "../data-access/canvas.js";
import { generateSignedUrl } from "../utils/storage.js";

/**
 * Options for filtering inputs.
 */
type InputFilterOptions = {
	dataType?: DataType;
	label?: string;
};

/**
 * Resolve the actual data value that flows into a target node through an edge.
 */
function resolveSourceValue(
	data: CanvasCtxDataWithTasks,
	edge: CanvasCtxDataWithTasks["edges"][number],
) {
	const sourceHandle = data.handles.find((h) => h.id === edge.sourceHandleId);
	if (!sourceHandle) throw new Error("Source handle missing");

	const sourceNode = data.nodes.find((n) => n.id === sourceHandle.nodeId);
	if (!sourceNode) throw new Error("Source node missing");

	// Transistent nodes saves result in Task.result
	const sourceNodeTask = data.tasks.find((f) => f.nodeId === sourceNode.id);
	const resultToUse = (sourceNodeTask?.result ??
		sourceNode.result) as NodeResult | null;

	if (!resultToUse || resultToUse.outputs.length === 0) return null;

	const selected = resultToUse.outputs[resultToUse.selectedOutputIndex ?? 0];
	const item = selected.items.find(
		(i) => i.outputHandleId === edge.sourceHandleId,
	);
	return item ?? null;
}

/**
 * Get the input value for a given data type on a target node, with optional filters.
 * - required = true → throws if missing
 * - Allows optional inputs (system prompt, image, etc.)
 * - Warns if multiple matching edges exist (takes the first)
 * - If options.label is provided, matches on the target handle's label
 * - If options.dataType is not provided, returns first one
 */
function getInputValue(
	data: CanvasCtxDataWithTasks,
	targetNodeId: string,
	required: boolean = true,
	options: InputFilterOptions,
) {
	let incoming = data.edges.filter((e) => e.target === targetNodeId);

	if (options.dataType) {
		incoming = incoming.filter((e) => {
			assert(options.dataType); // Just to make ts happe.
			const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.dataTypes.includes(options.dataType);
		});
	}

	if (options.label) {
		incoming = incoming.filter((e) => {
			const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.label === options.label;
		});
	}

	if (incoming.length === 0) {
		if (required) {
			throw new Error(
				`Required ${options.dataType} input${options.label ? ` with label "${options.label}"` : ""} not connected`,
			);
		}
		return null;
	}

	if (incoming.length > 1) {
		console.warn(
			`Multiple ${options.dataType} edges${options.label ? ` with label "${options.label}"` : ""} connected to node ${targetNodeId}. Using the first one.`,
		);
	}
	const value = resolveSourceValue(data, incoming[0]);
	if ((value === null || value === undefined) && required) {
		throw new Error(
			`No value received from ${options.dataType} input${options.label ? ` with label "${options.label}"` : ""}`,
		);
	}

	return value;
}

function getInputValuesByType(
	data: CanvasCtxDataWithTasks,
	targetNodeId: string,
	options: InputFilterOptions,
) {
	let incoming = data.edges.filter((e) => e.target === targetNodeId);

	if (options.dataType) {
		incoming = incoming.filter((e) => {
			assert(options.dataType); // Just to make ts happe.
			const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.dataTypes.includes(options.dataType);
		});
	}

	if (options.label) {
		incoming = incoming.filter((e) => {
			const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.label === options.label;
		});
	}

	const values = incoming.map((edge) => resolveSourceValue(data, edge));
	return values;
}

function getAllOutputHandles(data: CanvasCtxDataWithTasks, nodeId: string) {
	return data.handles.filter((e) => e.nodeId === nodeId && e.type === "Output");
}

function getAllInputValuesWithHandle(
	data: CanvasCtxDataWithTasks,
	targetNodeId: string,
) {
	const incoming = data.edges.filter((e) => e.target === targetNodeId);

	const values = incoming.map((edge) => ({
		handle: data.handles.find((h) => h.id === edge.targetHandleId),
		value: resolveSourceValue(data, edge),
	}));
	return values;
}

/**
 * @param fileData Filedata of node
 * @returns A data url if exists, A new signed url if it doesn't exprired or signed url of unexpired signed url
 */
async function resolveFileUrl(fileData: FileData) {
	if (fileData.processData?.dataUrl) {
		return fileData.processData?.dataUrl;
	}
	if (fileData.entity) {
		const expiration = fileData.entity.signedUrlExp;
		const now = new Date();
		const dayLater = add(now, { days: 1 });
		const isExpired = expiration == null || dayLater < new Date(expiration);
		if (!isExpired) {
			return fileData.entity.signedUrl;
		}
		const aWeekLater = add(now, { weeks: 1 });

		const A_WEEKISH = 3600 * 24 * 6.9; // A bit less than a week
		const newUrl = await generateSignedUrl(
			fileData.entity.key,
			fileData.entity.bucket,
			A_WEEKISH,
		);
		await prisma.fileAsset.update({
			data: {
				signedUrl: newUrl,
				signedUrlExp: aWeekLater,
			},
			where: {
				id: fileData.entity.id,
			},
		});

		return newUrl;
	}
}

export {
	resolveSourceValue,
	getInputValue,
	getAllOutputHandles,
	getAllInputValuesWithHandle,
	getInputValuesByType,
	resolveFileUrl,
};
