import { useMemo } from "react";
import type { NodeEntityType } from "@/store/nodes";

const useHasOutputItems = (nodeEntity: NodeEntityType | undefined) =>
	useMemo(() => {
		if (!nodeEntity) {
			return false;
		}
		const outputs = nodeEntity?.result?.outputs;
		const hasOutputs = outputs?.length;
		if (hasOutputs) {
			const hasItems = outputs[0].items && outputs[0].items.length > 0;
			return hasItems;
		}
		return false;
	}, [nodeEntity]);

export { useHasOutputItems };
