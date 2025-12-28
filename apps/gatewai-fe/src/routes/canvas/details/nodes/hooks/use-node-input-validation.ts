import { useAppSelector } from "@/store";
import { makeSelectAllEdges } from "@/store/edges";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { makeSelectAllNodeEntities, makeSelectNodeById } from "@/store/nodes";
import type { Handle } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import type { Node } from "@xyflow/react";
import { useMemo } from "react";

type ValidationError = {
	handleId: Handle["id"];
	error: string;
};

function useNodeInputValidation(nodeId: Node["id"]): ValidationError[] {
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const nodeEntities = useAppSelector(makeSelectAllNodeEntities);
	const nodeHandles = useAppSelector(makeSelectHandlesByNodeId(nodeId));
	const edges = useAppSelector(makeSelectAllEdges);

	const validationResult = useMemo(() => {
		if (!node) {
			return [];
		}
		const connectedEdges = edges.filter((f) => f.target === node.id);
		const errors: ValidationError[] = [];
		connectedEdges.forEach((edge) => {
			const sourceNode = nodeEntities[edge.source];
			const targetHandle = nodeHandles.find(
				(f) => f.id === edge.targetHandleId,
			);
			if (targetHandle) {
				if (!sourceNode?.result) {
					return;
				}
				const sourceResult = sourceNode.result as unknown as NodeResult;
				const outputIndex = sourceResult?.selectedOutputIndex ?? 0;

				const selectedOutput = sourceResult.outputs[outputIndex];
				if (!selectedOutput) {
					return;
				}
				const outputItem = selectedOutput.items.find(
					(f) => f.outputHandleId === edge.sourceHandleId,
				);
				const outputItemType = outputItem?.type;
				if (!outputItemType) {
					return;
				}
				if (!targetHandle.dataTypes?.includes(outputItemType)) {
					errors.push({
						handleId: targetHandle.id,
						error: `Invalid data type`,
					});
				}
			}
		});

		return errors;
	}, [edges, node, nodeEntities, nodeHandles]);

	return validationResult;
}

export { useNodeInputValidation };
