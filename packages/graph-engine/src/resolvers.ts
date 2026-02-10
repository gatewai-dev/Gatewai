import assert from "node:assert";
import type { CanvasCtxDataWithTasks } from "@gatewai/data-ops";
import type { DataType } from "@gatewai/db";
import type { FileData, NodeResult, StorageService } from "@gatewai/types";

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
 */
function getInputValue(
	data: unknown,
	targetNodeId: string,
	required: boolean = true,
	options: InputFilterOptions,
) {
	const ctx = data as CanvasCtxDataWithTasks;
	let incoming = ctx.edges.filter((e) => e.target === targetNodeId);

	if (options.dataType) {
		incoming = incoming.filter((e) => {
			assert(options.dataType);
			const targetHandle = ctx.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.dataTypes.includes(options.dataType);
		});
	}

	if (options.label) {
		incoming = incoming.filter((e) => {
			const targetHandle = ctx.handles.find((h) => h.id === e.targetHandleId);
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
		incoming.sort((a, b) => {
			const handleA = ctx.handles.find((h) => h.id === a.targetHandleId);
			const handleB = ctx.handles.find((h) => h.id === b.targetHandleId);
			return (handleA?.order ?? 0) - (handleB?.order ?? 0);
		});

		console.warn(
			`Multiple ${options.dataType} edges${options.label ? ` with label "${options.label}"` : ""} connected to node ${targetNodeId}. Using the first one.`,
		);
	}
	const value = resolveSourceValue(ctx, incoming[0]);
	if ((value === null || value === undefined) && required) {
		throw new Error(
			`No value received from ${options.dataType} input${options.label ? ` with label "${options.label}"` : ""}`,
		);
	}

	return value;
}

function getInputValuesByType(
	data: unknown,
	targetNodeId: string,
	options: InputFilterOptions,
) {
	const ctx = data as CanvasCtxDataWithTasks;
	let incoming = ctx.edges.filter((e) => e.target === targetNodeId);

	if (options.dataType) {
		incoming = incoming.filter((e) => {
			assert(options.dataType);
			const targetHandle = ctx.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.dataTypes.includes(options.dataType);
		});
	}

	if (options.label) {
		incoming = incoming.filter((e) => {
			const targetHandle = ctx.handles.find((h) => h.id === e.targetHandleId);
			return targetHandle?.label === options.label;
		});
	}

	incoming.sort((a, b) => {
		const handleA = ctx.handles.find((h) => h.id === a.targetHandleId);
		const handleB = ctx.handles.find((h) => h.id === b.targetHandleId);
		return (handleA?.order ?? 0) - (handleB?.order ?? 0);
	});

	const values = incoming.map((edge) => resolveSourceValue(ctx, edge));
	return values;
}

function getAllOutputHandles(data: unknown, nodeId: string) {
	const ctx = data as CanvasCtxDataWithTasks;
	return ctx.handles.filter((e) => e.nodeId === nodeId && e.type === "Output");
}

function getAllInputValuesWithHandle(data: unknown, targetNodeId: string) {
	const ctx = data as CanvasCtxDataWithTasks;
	const incoming = ctx.edges.filter((e) => e.target === targetNodeId);

	incoming.sort((a, b) => {
		const handleA = ctx.handles.find((h) => h.id === a.targetHandleId);
		const handleB = ctx.handles.find((h) => h.id === b.targetHandleId);
		return (handleA?.order ?? 0) - (handleB?.order ?? 0);
	});

	const values = incoming.map((edge) => ({
		handle: ctx.handles.find((h) => h.id === edge.targetHandleId),
		value: resolveSourceValue(ctx, edge),
	}));
	return values;
}

/**
 * @param fileData Filedata of node
 * @returns Returns file data from Storage (GCS)
 */
async function loadMediaBuffer(storage: StorageService, fileData: FileData) {
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
	const arrayBuffer = await storage.getFromGCS(key, bucket);
	return arrayBuffer;
}

async function getFileDataMimeType(
	storage: StorageService,
	fileData: FileData,
) {
	if (fileData?.entity?.mimeType) return fileData?.entity?.mimeType;
	if (fileData?.processData?.mimeType) return fileData?.processData?.mimeType;
	if (fileData?.processData?.tempKey) {
		// Trying to get metadata from storage if available
		// Assuming implementation has it or we catch error
		try {
			const metadata = await storage.getObjectMetadata(
				fileData?.processData?.tempKey,
			);
			return metadata?.contentType ?? null;
		} catch (e) {
			console.warn("Failed to get metadata", e);
			return null;
		}
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
