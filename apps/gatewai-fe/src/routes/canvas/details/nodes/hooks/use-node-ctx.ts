import { useMemo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectAllEdges } from "@/store/edges";
import {
	makeSelectAllHandles,
	makeSelectHandlesByNodeId,
} from "@/store/handles";
import {
	makeSelectAllNodes,
	makeSelectNodeById,
	type NodeEntityType,
} from "@/store/nodes";

function useNodeContext({ nodeId }: { nodeId: NodeEntityType["id"] }) {
	const allNodes = useAppSelector(makeSelectAllNodes);
	const allHandles = useAppSelector(makeSelectAllHandles);
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const nodeHandles = useAppSelector(makeSelectHandlesByNodeId(nodeId));
	const allEdges = useAppSelector(makeSelectAllEdges);
	const context = useMemo(() => {
		if (!node || !nodeHandles.length) {
			return null;
		}

		const inputHandles = nodeHandles.filter((h) => h.type === "Input");
		// Removed redundant if (!nodeHandles) - it's always truthy here

		const inputEdges = allEdges.filter((f) =>
			inputHandles.map((m) => m.id).includes(f.targetHandleId),
		);

		const sourceHandles = allHandles.filter((h) =>
			inputEdges.map((m) => m.sourceHandleId).includes(h.id),
		);

		const sourceNodes = allNodes.filter((n) =>
			sourceHandles.map((m) => m.nodeId).includes(n.id),
		);

		return { sourceNodes, sourceHandles, inputEdges, inputHandles };
	}, [node, nodeHandles, allEdges, allHandles, allNodes]);

	return context;
}

export { useNodeContext };
