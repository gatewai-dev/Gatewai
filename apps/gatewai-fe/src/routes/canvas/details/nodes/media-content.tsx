import type { FileResult, ImagesResult, VideoGenResult } from "@gatewai/types";
import { FileIcon } from "lucide-react";
import type { NodeEntityType } from "@/store/nodes";
import { useNodeResultHash } from "../processor/processor-ctx";
import { CanvasRenderer } from "./common/canvas-renderer";
import { OutputSelector } from "./misc/output-selector";

function MediaContent({
	node,
	result,
}: {
	node: NodeEntityType;
	result: ImagesResult | FileResult | VideoGenResult;
}) {
	const selectedOutput = result.outputs[result.selectedOutputIndex];
	const outputItem = selectedOutput.items[0];
	const isImage = outputItem.data.entity?.mimeType.startsWith("image");
	const isOther = !isImage;
	const resultHash = useNodeResultHash(node.id);

	if (!outputItem.data.entity?.signedUrl) {
		return null;
	}
	const hasMoreThanOneOutput = result.outputs.length > 1;
	return (
		<div className="relative h-full w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}
			{isImage && resultHash && <CanvasRenderer resultHash={resultHash} />}
			{isOther && (
				<div className="flex flex-col items-center gap-2">
					<FileIcon className="w-5 h-5" />{" "}
					<span>{outputItem.data.entity.name}</span>
				</div>
			)}
		</div>
	);
}

export { MediaContent };
