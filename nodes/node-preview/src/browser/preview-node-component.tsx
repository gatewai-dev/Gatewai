import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { FileData } from "@gatewai/core/types";
import {
	AudioRenderer,
	BaseNode,
	CanvasRenderer,
	MediaDimensions,
	type NodeProps,
	useNodeResult,
	VideoRenderer,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { cn, MarkdownRenderer, ScrollArea, Switch } from "@gatewai/ui-kit";
import { FileIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

const ImagePreview = memo(({ data }: { data: FileData }) => {
	const imageUrl = useMemo(() => {
		if (data.entity) {
			return GetAssetEndpoint(data.entity);
		} else if (data.processData?.dataUrl) {
			return data.processData?.dataUrl;
		}
	}, [data]);

	return <CanvasRenderer imageUrl={imageUrl} />;
});

ImagePreview.displayName = "ImagePreview";

const PreviewNodeComponent = memo((props: NodeProps) => {
	const { result, error } = useNodeResult(props.id);
	const node = useAppSelector(makeSelectNodeById(props.id));
	const [showMarkdown, setShowMarkdown] = useState(false);
	console.log({result, error})
	if (!result || error) {
		return (
			<BaseNode {...props}>
				<div className="flex flex-col items-center justify-center h-32">
					<p className="text-muted-foreground">Connect a node to preview</p>
				</div>
			</BaseNode>
		);
	}

	const selectedOutput = result.outputs[result.selectedOutputIndex ?? 0];
	const outputItem = selectedOutput.items[0];
	const outputType = outputItem.type;
	const outputData = outputItem.data;

	const getMediaSource = (): string | undefined => {
		if (
			typeof outputData === "object" &&
			"entity" in outputData &&
			outputData.entity
		) {
			return GetAssetEndpoint(outputData.entity);
		} else if (
			typeof outputData === "object" &&
			"processData" in outputData &&
			outputData.processData
		) {
			return outputData.processData?.dataUrl;
		}
		return undefined;
	};

	const renderContent = () => {
		if (outputType === "Text" && typeof outputData === "string") {
			return (
				<div className="flex flex-col gap-2 nodrag nopan">
					<ScrollArea
						viewPortCn="max-h-[350px] overflow-auto"
						className="bg-input p-2 w-full"
					>
						{showMarkdown ? (
							<MarkdownRenderer className="text-sm" markdown={outputData} />
						) : (
							<div className="whitespace-pre-wrap text-xs">{outputData}</div>
						)}
					</ScrollArea>
					<div className="flex items-center justify-end mb-2 gap-2">
						<span className="text-sm text-muted-foreground">Markdown</span>
						<Switch checked={showMarkdown} onCheckedChange={setShowMarkdown} />
					</div>
				</div>
			);
		}

		if (outputType === "Image") {
			return <ImagePreview data={outputData as FileData} />;
		}

		if (outputType === "Video") {
			const src = getMediaSource();
			if (!src) return null;

			return <VideoRenderer src={src} />;
		}

		if (outputType === "Audio") {
			const src = getMediaSource();
			if (!src) return null;

			return <AudioRenderer src={src} />;
		}

		// Fallback for other file types (e.g.,  "Audio", etc.)
		let entityName = "Unknown file";
		if (
			typeof outputData === "object" &&
			"entity" in outputData &&
			outputData.entity
		) {
			entityName = outputData.entity.name;
		}
		return (
			<div className="flex flex-col items-center justify-center gap-2 h-32">
				<FileIcon className="w-5 h-5" />
				<span>{entityName}</span>
			</div>
		);
	};

	const isVideoOrImage = ["Video", "Image"].includes(outputType);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div
				className={cn("w-full overflow-hidden rounded relative", {
					"media-container": isVideoOrImage,
				})}
			>
				<div className="relative h-full w-full group">
					{renderContent()}

					{node && (
						<div className="absolute bottom-1 left-1 z-10">
							<MediaDimensions node={node} />
						</div>
					)}
				</div>
			</div>
		</BaseNode>
	);
});

export { PreviewNodeComponent };
