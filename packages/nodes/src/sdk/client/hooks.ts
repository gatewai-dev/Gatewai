import { useNodeUI } from "./ui.js";

export function useNodeResult(nodeId: string) {
	const { useNodeResult: hostUseNodeResult } = useNodeUI();
	return hostUseNodeResult(nodeId);
}

export function useNodePreview(nodeId: string) {
	const { useNodePreview: hostUseNodePreview } = useNodeUI();
	return hostUseNodePreview(nodeId);
}

export function useNodeValidation(nodeId: string) {
	const { useNodeValidation: hostUseNodeValidation } = useNodeUI();
	return hostUseNodeValidation(nodeId);
}

export function useNodeConfig() {
	const { onNodeConfigUpdate } = useNodeUI();
	return { updateConfig: onNodeConfigUpdate };
}
