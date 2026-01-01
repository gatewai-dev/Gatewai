import type { FileData } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { FileIcon } from "lucide-react";
import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaSeekBackwardButton,
	MediaSeekForwardButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from "media-chrome";
import { memo, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GetAssetEndpoint } from "@/utils/file";
import { MarkdownRenderer } from "../../components/markdown-renderer";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { PreviewNode } from "../node-props";

const ImagePreview = memo(({ data }: { data: FileData }) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let src: string | undefined;
		if (data.entity) {
			src = GetAssetEndpoint(data.entity.id);
		} else if (data.processData?.dataUrl) {
			src = data.processData?.dataUrl;
		}
		if (!src) return;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = src;

		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.style.width = "100%";
			canvas.style.height = "auto";
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0);
			}
		};

		img.onerror = (err) => {
			console.error("Failed to load image for preview:", err);
		};
	}, [data]);

	return <canvas ref={canvasRef} className="block w-full h-auto" />;
});

ImagePreview.displayName = "ImagePreview";

const PreviewNodeComponent = memo((props: NodeProps<PreviewNode>) => {
	const { result } = useNodeResult(props.id);

	if (!result) {
		return (
			<BaseNode {...props}>
				<div className="flex flex-col items-center justify-center h-32">
					<p className="text-muted-foreground">Connect media to preview</p>
				</div>
			</BaseNode>
		);
	}

	const selectedOutput = result.outputs[result.selectedOutputIndex ?? 0];
	const outputItem = selectedOutput.items[0];
	const outputType = outputItem.type;
	const outputData = outputItem.data;

	const getMediaSource = (): string | undefined => {
		if ("entity" in outputData && outputData.entity) {
			return GetAssetEndpoint(outputData.entity.id);
		} else if ("processData" in outputData && outputData.processData) {
			return outputData.processData?.dataUrl;
		}
		return undefined;
	};

	const renderContent = () => {
		if (outputType === "Text" && typeof outputData === "string") {
			return (
				<ScrollArea viewPortCn="max-h-[350px]" className="bg-input p-2 w-full ">
					<MarkdownRenderer markdown={outputData} />
				</ScrollArea>
			);
		}

		if (outputType === "Image") {
			return <ImagePreview data={outputData as FileData} />;
		}

		if (outputType === "Video") {
			const src = getMediaSource();
			if (!src) return null;

			return (
				<MediaController className="w-full h-auto block">
					<video
						slot="media"
						src={src}
						preload="auto"
						muted
						playsInline
						className="w-full h-auto"
					/>
					<MediaControlBar>
						<MediaPlayButton></MediaPlayButton>
						<MediaSeekBackwardButton></MediaSeekBackwardButton>
						<MediaSeekForwardButton></MediaSeekForwardButton>
						<MediaTimeDisplay></MediaTimeDisplay>
						<MediaTimeRange></MediaTimeRange>
						<MediaMuteButton></MediaMuteButton>
						<MediaVolumeRange></MediaVolumeRange>
						<MediaFullscreenButton></MediaFullscreenButton>
					</MediaControlBar>
				</MediaController>
			);
		}

		// Fallback for other file types (e.g., "File", "Audio", etc.)
		let entityName = "Unknown file";
		if ("entity" in outputData && outputData.entity) {
			entityName = outputData.entity.name;
		}
		return (
			<div className="flex flex-col items-center justify-center gap-2 h-32">
				<FileIcon className="w-5 h-5" />
				<span>{entityName}</span>
			</div>
		);
	};

	return (
		<BaseNode {...props}>
			<div className="w-full overflow-hidden rounded media-container relative">
				<div className="relative h-full w-full group">{renderContent()}</div>
			</div>
		</BaseNode>
	);
});

PreviewNodeComponent.displayName = "PreviewNodeComponent";

export { PreviewNodeComponent };
