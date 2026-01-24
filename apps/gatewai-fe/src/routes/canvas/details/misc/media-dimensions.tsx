import type { FileData } from "@gatewai/types";
import { Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeEntityType } from "@/store/nodes";
import { useNodeResult } from "../graph-engine/processor-ctx";

function MediaDimensions({
	node,
	className,
}: {
	node: NodeEntityType;
	className?: string;
}) {
	const { result } = useNodeResult(node?.id);

	const outputItem = result?.outputs?.[result.selectedOutputIndex];
	if (!outputItem) return null;
	const items = outputItem?.items;
	const firstImageOrVideoOutputItem = items?.find(
		(f) => f.type === "Video" || f.type === "Image",
	);
	const outputFile = firstImageOrVideoOutputItem?.data as FileData;
	if (!outputFile) return null;
	const width = outputFile.entity?.width ?? outputFile.processData?.width;
	const height = outputFile.entity?.height ?? outputFile.processData?.height;

	// Don't render anything if dimensions are missing
	if (!width || !height) return null;

	return (
		<div
			className={cn(
				"bg-background/20 text-white text-[9px] p-1 flex items-center gap-1",
				className,
			)}
		>
			<span className="flex items-center gap-1 font-medium tracking-tight">
				<Ruler size={11} strokeWidth={2.5} className="opacity-80" />
				{width} × {height}
			</span>
		</div>
	);
}

export { MediaDimensions };
