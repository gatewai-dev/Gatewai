import type { FileData } from "@gatewai/types";
import { useMemo } from "react";
import { GetAssetEndpoint } from "@/lib/file";
import { useAppSelector } from "@gatewai/react-store";
import { makeSelectNodeById } from "@gatewai/react-store";
import {
	useNodeResult,
	useNodeValidation,
} from "../graph-engine/processor-ctx";

export function useNodePreview(nodeId: string) {
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const { result } = useNodeResult(nodeId);
	const validation = useNodeValidation(nodeId);

	return useMemo(() => {
		const hasInvalidInput = validation && Object.keys(validation).length > 0;
		const isTerminalNode = node?.template.isTerminalNode;
		const shouldHidePreview = !isTerminalNode && hasInvalidInput;

		const outputItem = result?.outputs?.[result?.selectedOutputIndex]?.items[0];
		const inputFileData = outputItem?.data as FileData;

		const imageUrl =
			inputFileData?.processData?.dataUrl ??
			(inputFileData?.entity ? GetAssetEndpoint(inputFileData.entity) : null);

		return {
			imageUrl: shouldHidePreview ? null : imageUrl,
			node,
			result,
			hasMoreThanOneOutput: (result?.outputs?.length ?? 0) > 1,
		};
	}, [node, result, validation]);
}
