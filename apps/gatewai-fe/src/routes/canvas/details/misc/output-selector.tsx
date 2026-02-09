import type { NodeResult } from "@gatewai/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@gatewai/ui-kit";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";

function OutputSelector({ node }: { node: NodeEntityType }) {
	const { onNodeResultUpdate } = useCanvasCtx();

	const result = node?.result as unknown as NodeResult;
	if (!result || Number.isNaN(result.selectedOutputIndex)) {
		return null;
	}

	const incrementSelectedIndex = () => {
		if (!node.result) {
			return;
		}
		const nodeResult = node.result as unknown as NodeResult;
		onNodeResultUpdate({
			id: node.id,
			newResult: {
				...nodeResult,
				selectedOutputIndex: Math.min(
					result.selectedOutputIndex + 1,
					result.outputs.length - 1,
				),
			} as typeof nodeResult,
		});
	};

	const decrementSelectedIndex = () => {
		if (!node.result) {
			return;
		}
		const nodeResult = node.result as unknown as NodeResult;
		onNodeResultUpdate({
			id: node.id,
			newResult: {
				...nodeResult,
				selectedOutputIndex: Math.max(result.selectedOutputIndex - 1, 0),
			} as typeof nodeResult,
		});
	};

	return (
		<div className="bg-background/20 text-white text-[8px] flex items-center gap-1">
			<Button
				size="xs"
				onClick={() => decrementSelectedIndex()}
				variant="ghost"
			>
				<ChevronLeft />
			</Button>
			<span>
				{result.selectedOutputIndex + 1} / {result.outputs.length}
			</span>
			<Button
				size="xs"
				onClick={() => incrementSelectedIndex()}
				variant="ghost"
			>
				<ChevronRight />
			</Button>
		</div>
	);
}

export { OutputSelector };
