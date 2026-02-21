import {
	fontManager,
	GetAssetEndpoint,
	GetFontAssetUrl,
} from "@gatewai/core/browser";
import type {
	ExtendedLayer,
	FileData,
	VirtualVideoData,
} from "@gatewai/core/types";
import {
	AddCustomHandleButton,
	BaseNode,
	type NodeProps,
	useDownloadFileData,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import {
	CompositionScene,
	resolveVideoSourceUrl,
} from "@gatewai/remotion-compositions";
import { Button, cn } from "@gatewai/ui-kit";

import { Player } from "@remotion/player";
import { Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { remotionService } from "./muxer-service.js";
import { DEFAULT_DURATION_FRAMES, FPS } from "./video-editor/config/index.js";

const VideoCompositorNodeComponent = memo((props: NodeProps) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const [isDownloading, setIsDownloading] = useState(false);
	const { inputs } = useNodeResult(props.id);
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
			let src: string | undefined;
			let text: string | undefined;
			let layerWidth = saved.width;
			let layerHeight = saved.height;
			let virtualVideo: VirtualVideoData | undefined;

			if (item.type === "Text") {
				text = (item.data as string) || "";
			} else if (item.type === "Video") {
				// Video inputs are always VirtualVideoData
				const vv = item.data as VirtualVideoData;
				virtualVideo = vv;
				src = resolveVideoSourceUrl(vv);
				if (!layerWidth) layerWidth = vv.sourceMeta?.width;
				if (!layerHeight) layerHeight = vv.sourceMeta?.height;
			} else if (item.type === "Image" || item.type === "Audio") {
				const fileData = item.data as FileData;
				if (fileData) {
					src = fileData.entity?.id
						? GetAssetEndpoint(fileData.entity)
						: fileData.processData?.dataUrl;
					if (!layerWidth) layerWidth = fileData.processData?.width;
					if (!layerHeight) layerHeight = fileData.processData?.height;
				}
			}

			// Duration: Video uses sourceMeta, Audio/Image uses FileData
			const durationMs =
				item.type === "Video"
					? ((item.data as VirtualVideoData).sourceMeta?.durationMs ?? 0)
					: item.type !== "Text"
						? ((item.data as FileData)?.entity?.duration ??
							(item.data as FileData)?.processData?.duration ??
							0)
						: 0;

			const calculatedDurationFrames =
				(item.type === "Video" || item.type === "Audio") && durationMs > 0
					? Math.ceil((durationMs / 1000) * FPS)
					: DEFAULT_DURATION_FRAMES;

			const layer: ExtendedLayer = {
				id: saved.id ?? handleId,
				inputHandleId: handleId,
				type: item.type as ExtendedLayer["type"],
				x: saved.x ?? 0,
				y: saved.y ?? 0,
				rotation: saved.rotation ?? 0,
				scale: saved.scale ?? 1,
				opacity: saved.opacity ?? 1,
				zIndex: saved.zIndex ?? ++maxZ,
				startFrame: saved.startFrame ?? 0,
				durationInFrames: saved.durationInFrames ?? calculatedDurationFrames,
				volume: saved.volume ?? 1,
				animations: saved.animations ?? [],
				width: layerWidth ?? width,
				height: layerHeight ?? height,
				...saved,
				// Resolved values must come AFTER ...saved to avoid being overridden
				src,
				text,
				virtualVideo,
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
				});
			} else if (item.type === "Image" || item.type === "Video") {
				layers.push({
					...layer,
					type: item.type,
					width: layerWidth ?? width,
					height: layerHeight ?? height,
					virtualVideo,
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
			}
		}

		layers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

		const durationInFrames =
			layers.length > 0
				? Math.max(
						DEFAULT_DURATION_FRAMES,
						...layers.map(
							(l) =>
								(l.startFrame ?? 0) +
								(l.durationInFrames ?? DEFAULT_DURATION_FRAMES),
						),
					)
				: DEFAULT_DURATION_FRAMES;

		return { layers, width, height, durationInFrames };
	}, [node, inputs]);

	const aspectRatio = useMemo(() => {
		if (!previewState.width || !previewState.height) return 16 / 9;
		return previewState.width / previewState.height;
	}, [previewState.width, previewState.height]);

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
					className={cn(
						"w-full overflow-hidden rounded bg-black/5 relative border border-border",
					)}
					style={{
						aspectRatio: `${aspectRatio}`,
						minHeight: hasInputs ? "120px" : "auto",
					}}
				>
					{hasInputs ? (
						<Player
							acknowledgeRemotionLicense
							component={CompositionScene}
							inputProps={{
								layers: previewState.layers,
								viewportWidth: previewState.width,
								viewportHeight: previewState.height,
							}}
							durationInFrames={previewState.durationInFrames}
							fps={FPS}
							compositionWidth={previewState.width}
							compositionHeight={previewState.height}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "contain",
							}}
							controls={true}
							loop
							autoPlay={false}
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs italic">
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
