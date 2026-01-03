import type { FileResult, ImagesResult } from "@gatewai/types";
import { FileIcon } from "lucide-react";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { CanvasRenderer } from "./common/canvas-renderer";
import { OutputSelector } from "./misc/output-selector";

function MediaContent({
	node,
	result,
}: {
	node: NodeEntityType;
	result: ImagesResult | FileResult;
}) {
	const selectedOutput = result.outputs[result.selectedOutputIndex];
	const outputItem = selectedOutput.items[0];
	const isImage = outputItem.data.entity?.mimeType.startsWith("image");
	const isOther = !isImage;
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
			{isImage && (
				<CanvasRenderer
					imageUrl={GetAssetEndpoint(outputItem.data.entity.id)}
				/>
			)}
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
