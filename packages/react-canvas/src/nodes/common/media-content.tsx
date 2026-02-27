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
import { ThreeDRenderer } from "./three-d-renderer";
import { VideoRenderer } from "./video-renderer";

function MediaContent({ node }: { node: NodeEntityType }) {
	const { result } = useNodeResult(node.id);
	const selectedOutput =
		result?.outputs?.[
			Math.min(result.selectedOutputIndex, result.outputs.length - 1)
		];
	const outputItem = selectedOutput?.items?.[0];
	console.log({ outputItem });

	const isImage = outputItem?.type === "Image";
	const isVideo = outputItem?.type === "Video";
	const isAudio = outputItem?.type === "Audio";
	const isLottie = outputItem?.type === "Lottie";
	const isJson = outputItem?.type === "Json";
	const isText = outputItem?.type === "Text";
	const isThreeD = outputItem?.type === "ThreeD";
	const isOther =
		!isImage &&
		!isVideo &&
		!isAudio &&
		!isLottie &&
		!isJson &&
		!isText &&
		!isThreeD;
	const hasMoreThanOneOutput = result?.outputs?.length > 1;

	console.log({ outputItem });

	const assetUrl = useMemo(() => {
		if (!outputItem?.data) return null;
		if (
			outputItem.type === "Video" ||
			outputItem.type === "Audio" ||
			outputItem.type === "ThreeD" ||
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

	const activeMeta = useMemo(() => {
		if (
			outputItem?.type === "Video" ||
			outputItem?.type === "Audio" ||
			outputItem?.type === "ThreeD" ||
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

	if (!outputItem) {
		return null;
	}

	console.log({ isThreeD, assetUrl });

	return (
		/*
		 * FIX: Removed `h-full` from the wrapper. `h-full` propagates zero when
		 * no ancestor in the flex/block chain has an explicit height, which is
		 * exactly the situation inside a canvas node's content area. Each renderer
		 * is now responsible for establishing its own height (ThreeDRenderer uses
		 * minHeight: 280; CanvasRenderer, VideoRenderer, etc. use their own
		 * intrinsic sizing). This prevents the silent 0-height collapse.
		 */
		<div className="relative w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}

			{isImage && assetUrl && <CanvasRenderer imageUrl={assetUrl} />}

			{(isVideo || isLottie) && (
				<VideoRenderer virtualMedia={outputItem.data} durationMs={durationMs} />
			)}

			{isAudio && assetUrl && (
				<AudioRenderer
					title={assetName}
					src={assetUrl}
					durationMs={durationMs}
					virtualMedia={outputItem.data}
				/>
			)}

			{/*
			 * FIX: ThreeDRenderer previously used `absolute inset-0` internally,
			 * which required a sized ancestor. The renderer is now self-sizing
			 * (relative + minHeight), so no wrapper div with an explicit height
			 * is needed here — it just participates in normal block flow.
			 */}
			{isThreeD && <ThreeDRenderer virtualMedia={outputItem.data} />}

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
