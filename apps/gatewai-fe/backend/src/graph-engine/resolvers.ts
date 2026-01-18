import assert from "node:assert";
import type { DataType } from "@gatewai/db";
import type { FileData, NodeResult } from "@gatewai/types";
import type { CanvasCtxDataWithTasks } from "../data-ops/canvas.js";
import { getFromGCS, getObjectMetadata } from "../utils/storage.js";

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
 * @returns Returns file data from Storage (GCS)
 */
async function loadMediaBuffer(fileData: FileData) {
	let mimeType: string | undefined;
	let key: string | undefined;
	let bucket: string | undefined;

	if (fileData?.entity) {
		key = fileData.entity.key;
		bucket = fileData.entity.bucket;
		mimeType = fileData.entity.mimeType;
	} else if (fileData?.processData) {
		key = fileData.processData.tempKey;
		mimeType = fileData.processData.mimeType;
		bucket = undefined;
	} else {
		throw new Error("Image data could not be found");
	}
	assert(key);
	assert(mimeType);
	const arrayBuffer = await getFromGCS(key, bucket);
	return arrayBuffer;
}

async function getFileDataMimeType(fileData: FileData) {
	if (fileData?.entity?.mimeType) return fileData?.entity?.mimeType;
	if (fileData?.processData?.mimeType) return fileData?.processData?.mimeType;
	if (fileData?.processData?.tempKey) {
		const metadata = await getObjectMetadata(fileData?.processData?.tempKey);
		return metadata.contentType;
	}
	return null;
}

export {
	resolveSourceValue,
	getInputValue,
	getAllOutputHandles,
	getAllInputValuesWithHandle,
	getInputValuesByType,
	loadMediaBuffer,
	getFileDataMimeType,
};
