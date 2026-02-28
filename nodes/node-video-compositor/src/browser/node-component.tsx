import {
	fontManager,
	GetAssetEndpoint,
	GetFontAssetUrl,
} from "@gatewai/core/browser";
import type {
	ExtendedLayer,
	FileData,
	VirtualMediaData,
} from "@gatewai/core/types";
import {
	AddCustomHandleButton,
	BaseNode,
	MediaContent,
	MediaPlayer,
	type NodeProps,
	useDownloadFileData,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import {
	computeRenderParams,
	createVirtualMedia,
} from "@gatewai/remotion-compositions";
import { Button } from "@gatewai/ui-kit";

import { Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { remotionService } from "./muxer-service.js";
import { FPS } from "./video-editor/config/index.js";

const VideoCompositorNodeComponent = memo((props: NodeProps) => {
	const node = useAppSelector(makeSelectNodeById(props.id)) as any;
	const [isDownloading, setIsDownloading] = useState(false);
	const { inputs, result } = useNodeResult(props.id);
	const nav = useNavigate();
	const downloadFileData = useDownloadFileData();
	const previewState = useMemo(() => {
		const config = (node?.config as unknown as VideoCompositorNodeConfig) ?? {};
		const layerUpdates = config.layerUpdates || {};

		const width = config.width ?? 1920;
		const height = config.height ?? 1080;

		// Compute maxZ from existing layerUpdates to preserve ordering for new layers
		let maxZ = 0;
		for (const update of Object.values(layerUpdates)) {
			maxZ = Math.max(maxZ, (update as ExtendedLayer).zIndex ?? 0);
		}

		const layers: ExtendedLayer[] = [];

		for (const [handleId, input] of Object.entries(inputs)) {
			if (!input?.connectionValid) continue;
			const item = input.outputItem;
			if (!item) continue;

			const saved = layerUpdates[handleId] ?? {};
			const isAutoDimensions = saved.autoDimensions ?? true;
			let src: string | undefined;
			let text: string | undefined;
			let layerWidth = saved.width;
			let layerHeight = saved.height;
			let virtualMedia: VirtualMediaData | undefined;

			if (item.type === "Text") {
				text = (item.data as string) || "";
				virtualMedia = createVirtualMedia(text, "Text");
			} else if (item.type === "Video") {
				// Video inputs are always VirtualMediaData
				const vv = item.data as VirtualMediaData;
				virtualMedia = vv;
				const params = computeRenderParams(vv);
				src = params.sourceUrl;
				const metadata = vv.metadata || ({} as any);
				if (
					isAutoDimensions &&
					metadata.width != null &&
					metadata.height != null
				) {
					layerWidth = metadata.width ?? undefined;
					layerHeight = metadata.height ?? undefined;
				} else {
					layerWidth = layerWidth ?? metadata.width ?? undefined;
					layerHeight = layerHeight ?? metadata.height ?? undefined;
				}
			} else if (
				item.type === "Image" ||
				item.type === "SVG" ||
				item.type === "Audio" ||
				item.type === "Lottie"
			) {
				const fileData = item.data as FileData;
				// IMPORTANT: Convert FileData -> VirtualMediaData here so the downstream Player gets the right format
				virtualMedia = createVirtualMedia(fileData, item.type as any);

				if (fileData) {
					src = fileData.entity?.id
						? GetAssetEndpoint(fileData.entity)
						: fileData.processData?.dataUrl;

					const initialW =
						fileData.processData?.width ?? fileData.entity?.width ?? undefined;
					const initialH =
						fileData.processData?.height ??
						fileData.entity?.height ??
						undefined;

					if (isAutoDimensions && initialW != null && initialH != null) {
						layerWidth = initialW;
						layerHeight = initialH;
					} else {
						layerWidth = layerWidth ?? initialW;
						layerHeight = layerHeight ?? initialH;
					}
				}
			}

			// Duration: Video uses metadata, Audio/Image uses FileData
			const durationMs =
				item.type === "Video" || item.type === "Audio"
					? ((item.data as VirtualMediaData).metadata?.durationMs ?? 0)
					: item.type !== "Text"
						? ((item.data as FileData)?.entity?.duration ??
							(item.data as FileData)?.processData?.duration ??
							0)
						: 0;

			const calculatedDurationFrames =
				(item.type === "Video" || item.type === "Audio") && durationMs > 0
					? Math.ceil((durationMs / 1000) * FPS)
					: 0; // Default to 0, let the layer or composition decide if it needs more

			const layer: ExtendedLayer = {
				...saved,
				id: handleId,
				scale: saved.scale ?? 1,
				zIndex: saved.zIndex ?? ++maxZ,
				startFrame: saved.startFrame ?? 0,
				durationInFrames: saved.durationInFrames ?? calculatedDurationFrames,
				volume: saved.volume ?? 1,
				animations: saved.animations ?? [],
				width: layerWidth ?? width,
				height: layerHeight ?? height,
				src,
				text,
				virtualMedia,
				lottieLoop: saved.lottieLoop,
			};

			if (item.type === "Text") {
				layers.push({
					...layer,
					type: "Text",
					fontSize: saved.fontSize ?? 60,
					fontFamily: saved.fontFamily ?? "Inter",
					fill: saved.fill ?? "#ffffff",
					width: layerWidth ?? width,
					height: layerHeight ?? height,
					virtualMedia,
				});
			} else if (
				item.type === "Image" ||
				item.type === "Video" ||
				item.type === "SVG"
			) {
				layers.push({
					...layer,
					type: item.type as any,
					width: layerWidth ?? width,
					height: layerHeight ?? height,
					virtualMedia,
					maxDurationInFrames:
						item.type === "Video" && durationMs > 0
							? calculatedDurationFrames
							: undefined,
				});
			} else if (item.type === "Audio") {
				layers.push({
					...layer,
					type: "Audio",
					height: 0,
					width: 0,
					maxDurationInFrames:
						durationMs > 0 ? calculatedDurationFrames : undefined,
				});
			} else if (item.type === "Lottie") {
				// Base maxDuration on either the fetched JSON metadata or derived duration
				const lottieFrames = saved.lottieDurationMs
					? Math.ceil((saved.lottieDurationMs / 1000) * FPS)
					: durationMs > 0
						? calculatedDurationFrames
						: undefined;

				layers.push({
					...layer,
					type: "Lottie",
					width: layerWidth ?? width,
					height: layerHeight ?? height,
					maxDurationInFrames: lottieFrames,
				});
			}
		}

		layers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

		const durationInFrames =
			layers.length > 0
				? Math.max(
						0,
						...layers.map(
							(l) => (l.startFrame ?? 0) + (l.durationInFrames ?? 0),
						),
					)
				: 0;

		return { layers, width, height, durationInFrames };
	}, [node, inputs]);

	useEffect(() => {
		previewState?.layers.forEach((layer) => {
			if (layer.type === "Text" && layer.fontFamily) {
				const url = GetFontAssetUrl(layer.fontFamily);
				if (url) fontManager.loadFont(layer.fontFamily, url);
			}
		});
	}, [previewState]);

	const onClickDownload = async () => {
		setIsDownloading(true);
		try {
			const config = node.config as unknown as VideoCompositorNodeConfig;
			const result = await remotionService.processVideo(config, inputs);
			await downloadFileData(
				{
					processData: {
						dataUrl: result.dataUrl,
					},
				} as FileData,
				"Video",
			);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An unknown error occurred";
			toast.error(errorMessage);
			console.error("Download failed:", err);
		} finally {
			setIsDownloading(false);
		}
	};

	const hasInputs = previewState && previewState.layers.length > 0;

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col w-full">
				<div
					className="relative"
					style={{
						minHeight: hasInputs ? "120px" : "120px",
					}}
				>
					{result && node ? (
						<MediaContent node={node} />
					) : (
						<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs italic border-b border-white/10 w-full h-full">
							No input connected
						</div>
					)}
				</div>

				<div className="flex justify-between items-center gap-2  p-1.5">
					<AddCustomHandleButton
						dataTypes={node?.template.variableInputDataTypes}
						nodeId={props.id}
						type="Input"
					/>
					{node && (
						<div className="flex gap-2 shrink-0">
							<Button
								onClick={onClickDownload}
								variant="ghost"
								disabled={isDownloading}
								size="sm"
							>
								{isDownloading ? (
									<>
										<Loader2 className="size-3 mr-1 animate-spin" />
										Rendering...
									</>
								) : (
									<>
										<Download className="size-3 mr-1" />
										Download
									</>
								)}
							</Button>
							<Button onClick={() => nav(`view/${node.id}`)} size="sm">
								<VideoIcon className="size-4 mr-1" /> Editor
							</Button>
						</div>
					)}
				</div>
			</div>
		</BaseNode>
	);
});

export { VideoCompositorNodeComponent };
