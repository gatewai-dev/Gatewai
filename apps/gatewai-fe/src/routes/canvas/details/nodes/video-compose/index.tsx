import type { FileData, VideoCompositorNodeConfig } from "@gatewai/types";
import { Player } from "@remotion/player";
import type { NodeProps } from "@xyflow/react";
import { Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { useDownloadFileData } from "../../hooks/use-download-filedata";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { VideoCompositorNode } from "../node-props";
import {
	CompositionScene,
	DEFAULT_DURATION_FRAMES,
	type ExtendedLayer,
	FPS,
	injectFontFace,
} from "./common/composition";

const VideoCompositorNodeComponent = memo(
	(props: NodeProps<VideoCompositorNode>) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const [isDownloading, setIsDownloading] = useState(false);
		const { result, isProcessing } = useNodeResult(props.id);
		const nav = useNavigate();
		const downloadFileData = useDownloadFileData();

		// 1. Reconstruct Layers from Config + Inputs
		// Note: In a real flow, inputs might come from handles.
		// We assume 'result' might have 'inputs' or we fallback to config placeholders if not executed yet.
		// For accurate preview, we map the node config's layerUpdates.
		const previewState = useMemo(() => {
			const config = node?.config as unknown as VideoCompositorNodeConfig;
			if (!config) return null;

			const width = config.width ?? 1920;
			const height = config.height ?? 1080;
			const layerUpdates = config.layerUpdates || {};

			const layers: ExtendedLayer[] = Object.entries(layerUpdates).map(
				([id, update]) => {
					// Try to resolve content from result inputs if available, else placeholders
					// This logic depends on how your system stores handle data.
					// Assuming we can't easily get live handle data without execution,
					// we might use placeholders or try to access the connected node data if passed.
					// Here we setup the structural layer.

					// If the node has executed, we might find resolved data in `result.inputs`?
					// If not, we use basic config.

					return {
						id,
						inputHandleId: id,
						type: (update as any).type || "Image", // Fallback
						startFrame: 0,
						durationInFrames: DEFAULT_DURATION_FRAMES,
						x: 0,
						y: 0,
						scale: 1,
						rotation: 0,
						opacity: 1,
						...update,
						// Ensure numbers are numbers
						width: update.width ?? 100,
						height: update.height ?? 100,
						src: "", // Populate if URL known
						text: "Preview", // Populate if text known
					} as ExtendedLayer;
				},
			);

			// Calculate max duration for the timeline
			const durationInFrames =
				layers.length > 0
					? Math.max(
							DEFAULT_DURATION_FRAMES,
							...layers.map(
								(l) =>
									l.startFrame +
									(l.durationInFrames ?? DEFAULT_DURATION_FRAMES),
							),
						)
					: DEFAULT_DURATION_FRAMES;

			return { layers, width, height, durationInFrames };
		}, [node]);

		// Load fonts for preview
		useEffect(() => {
			previewState?.layers.forEach((l) => {
				if (l.type === "Text" && l.fontFamily) {
					const url = GetFontAssetUrl(l.fontFamily);
					if (url) injectFontFace(l.fontFamily, url);
				}
			});
		}, [previewState]);

		/**
		 * Main download handler (Downloads the RESULT mp4, not the preview)
		 */
		const onClickDownload = async () => {
			if (!result) {
				toast.error("No result available to download");
				return;
			}
			try {
				const selectedOutput = result.outputs[result.selectedOutputIndex];
				if (!selectedOutput || !selectedOutput.items.length) {
					throw new Error("No output items found");
				}
				const outputItem = selectedOutput.items[0];
				const { type, data } = outputItem;
				await downloadFileData(data as FileData, type);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "An unknown error occurred";
				toast.error(errorMessage);
				console.error("Download failed:", err);
			} finally {
				setIsDownloading(false);
			}
		};

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div
						className={cn(
							"w-full overflow-hidden rounded media-container relative bg-black",
							// Responsive height based on aspect ratio approx
							"h-48",
						)}
					>
						{previewState ? (
							<div className="absolute inset-0 w-full h-full">
								<Player
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
									}}
									controls={true} // Simple controls for node view
									loop
									autoPlay={false}
								/>
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground text-xs">
								No config
							</div>
						)}
					</div>
					<div className="flex justify-between items-center">
						<AddCustomHandleButton
							dataTypes={["Video", "Audio", "Image", "Text"]}
							nodeProps={props}
							type="Input"
						/>
						{node && (
							<div className="flex gap-2">
								<Button
									onClick={onClickDownload}
									variant="ghost"
									disabled={isProcessing || isDownloading || !result}
									size="sm"
								>
									{isDownloading && (
										<>
											<Loader2 className="size-3 mr-2 animate-spin" />
											Downloading...
										</>
									)}
									{isProcessing && (
										<>
											<Loader2 className="size-3 mr-2 animate-spin" />
											Rendering...
										</>
									)}
									{!isDownloading && !isProcessing && (
										<>
											<Download className="size-3 mr-2" />
											Download
										</>
									)}
								</Button>
								<Button
									onClick={() => nav(`video-editor/${node.id}`)}
									size="sm"
								>
									<VideoIcon /> Edit
								</Button>
							</div>
						)}
					</div>
				</div>
			</BaseNode>
		);
	},
);

VideoCompositorNodeComponent.displayName = "VideoCompositorNodeComponent";

export { VideoCompositorNodeComponent };
