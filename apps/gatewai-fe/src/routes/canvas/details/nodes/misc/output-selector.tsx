import type { NodeResult } from "@gatewai/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/store";
import {
	decrementSelectedResultIndex,
	incrementSelectedResultIndex,
	type NodeEntityType,
} from "@/store/nodes";

function OutputSelector({ node }: { node: NodeEntityType }) {
	const dispatch = useAppDispatch();
	const result = node?.result as unknown as NodeResult;
	if (!result || isNaN(result.selectedOutputIndex)) {
		return null;
	}
	const incrementSelectedIndex = () => {
		dispatch(incrementSelectedResultIndex({ id: node.id }));
	};

	const decrementSelectedIndex = () => {
		dispatch(decrementSelectedResultIndex({ id: node.id }));
	};

	return (
		<div className="bg-background/20  text-white text-[8px] flex items-center gap-1">
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
