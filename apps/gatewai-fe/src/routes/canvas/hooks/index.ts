import type { NodeResult } from "@gatewai/core/types";
import type { NodeEntityType } from "@gatewai/react-store";
import { useMemo } from "react";

const useHasOutputItems = (nodeEntity: NodeEntityType | undefined) =>
	useMemo(() => {
		if (!nodeEntity) {
			return false;
		}
		const nodeResult = nodeEntity?.result as unknown as NodeResult;
		const outputs = nodeResult?.outputs;
		const hasOutputs = outputs?.length;
		if (hasOutputs) {
			const hasItems = outputs[0].items && outputs[0].items.length > 0;
			return hasItems;
		}
		return false;
	}, [nodeEntity]);

export { useHasOutputItems };
