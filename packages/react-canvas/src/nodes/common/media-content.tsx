import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { FileData, NodeResult } from "@gatewai/core/types";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	getActiveMediaMetadata,
	resolveMediaSourceUrl,
} from "@gatewai/remotion-compositions";
import { FileIcon } from "lucide-react";
import { useMemo } from "react";
import { MediaDimensions, OutputSelector } from "../../components";
import { useNodeResult } from "../../processor-ctx";
import { AudioRenderer } from "./audio-renderer";
import { CanvasRenderer } from "./canvas-renderer";
import { SVGRenderer } from "./svg-renderer";
import { VideoRenderer } from "./video-renderer";

function MediaContent({ node }: { node: NodeEntityType }) {
	const { result } = useNodeResult(node.id);
	const selectedOutput =
		result?.outputs?.[
			Math.min(result.selectedOutputIndex, result.outputs.length - 1)
		];
	const outputItem = selectedOutput?.items?.[0];

	const hasMoreThanOneOutput = (result?.outputs?.length ?? 0) > 1;

	const assetUrl = useMemo(() => {
		if (!outputItem?.data) return null;
		if (
			outputItem.type === "Video" ||
			outputItem.type === "Audio" ||
			outputItem.type === "Lottie"
		) {
			return resolveMediaSourceUrl(outputItem.data);
		}
		const fileData = outputItem.data as FileData;
		if (fileData.processData) {
			return fileData.processData.dataUrl;
		}
		if (!fileData.entity) return null;
		return GetAssetEndpoint(fileData.entity);
	}, [outputItem]);

	const isSVGFileUrl = assetUrl?.toLowerCase().includes(".svg") ?? false;
	const itemDataAny = outputItem?.data as any;
	const isMimeTypeSVG =
		itemDataAny?.entity?.mimeType === "image/svg+xml" ||
		itemDataAny?.processData?.mimeType === "image/svg+xml" ||
		itemDataAny?.source?.entity?.mimeType === "image/svg+xml" ||
		itemDataAny?.source?.processData?.mimeType === "image/svg+xml";

	const isActualSVG =
		outputItem?.type === "SVG" || isSVGFileUrl || isMimeTypeSVG;
	const isImage = outputItem?.type === "Image" && !isActualSVG;
	const isSVG = isActualSVG;
	const isVideo = outputItem?.type === "Video";
	const isAudio = outputItem?.type === "Audio";
	const isLottie = outputItem?.type === "Lottie";
	const isJson = outputItem?.type === "Json";
	const isText = outputItem?.type === "Text";
	const isOther =
		!isImage &&
		!isVideo &&
		!isAudio &&
		!isLottie &&
		!isJson &&
		!isText &&
		!isSVG;

	const activeMeta = useMemo(() => {
		if (
			outputItem?.type === "Video" ||
			outputItem?.type === "Audio" ||
			outputItem?.type === "Lottie"
		) {
			return getActiveMediaMetadata(outputItem.data);
		}
		return null;
	}, [outputItem]);

	const durationMs = useMemo(() => {
		if (!outputItem?.data) return undefined;
		if (
			outputItem.type === "Video" ||
			outputItem.type === "Audio" ||
			outputItem.type === "Lottie"
		) {
			return activeMeta?.durationMs;
		}
		const fileData = outputItem.data as FileData;
		return fileData?.entity?.duration ?? fileData?.processData?.duration;
	}, [outputItem, activeMeta]);

	const assetName = useMemo(() => {
		if (!outputItem?.data) return undefined;
		const data = outputItem.data;
		return (data as FileData)?.entity?.name;
	}, [outputItem]);

	const dimensions = useMemo(() => {
		if (!outputItem?.data) return { width: undefined, height: undefined };
		const data = outputItem.data;
		const entity = (data as FileData)?.entity;
		const processData = (data as FileData)?.processData;
		return {
			width: entity?.width ?? processData?.width,
			height: entity?.height ?? processData?.height,
		};
	}, [outputItem]);

	if (!outputItem) {
		return null;
	}

	return (
		<div className="relative w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}

			{isImage && assetUrl && (
				<CanvasRenderer
					imageUrl={assetUrl}
					width={dimensions.width ?? undefined}
					height={dimensions.height ?? undefined}
				/>
			)}
			{isSVG && assetUrl && (
				<SVGRenderer
					imageUrl={assetUrl}
					width={dimensions.width ?? undefined}
					height={dimensions.height ?? undefined}
				/>
			)}

			{(isVideo || isLottie) && (
				<VideoRenderer
					virtualMedia={outputItem.data}
					durationMs={durationMs ?? undefined}
				/>
			)}

			{isAudio && assetUrl && (
				<AudioRenderer
					title={assetName}
					src={assetUrl}
					durationMs={durationMs ?? undefined}
					virtualMedia={outputItem.data}
				/>
			)}

			{isOther && (
				<div className="flex flex-col items-center gap-2">
					<FileIcon className="w-5 h-5" />
					<span>{(outputItem?.data as FileData)?.entity?.name}</span>
				</div>
			)}

			{node && (
				<div className="absolute bottom-1 left-1 z-10">
					<MediaDimensions node={node} />
				</div>
			)}
		</div>
	);
}

export { MediaContent };
