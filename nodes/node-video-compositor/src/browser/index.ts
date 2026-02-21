import type {
	ExtendedLayer,
	NodeProcessorParams,
	VirtualVideoData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { defineClient } from "@gatewai/node-sdk/browser";
import { PiFilmReelLight } from "react-icons/pi";
import { metadata } from "../metadata.js";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { VideoCompositorNodeComponent } from "./node-component.js";
import { FPS } from "./video-editor/config/index.js";
import { VideoCompositorView } from "./video-editor/video-compose-view/index.js";

class VideoCompositorBrowserProcessor implements IBrowserProcessor {
	async process({ node, inputs, context }: NodeProcessorParams) {
		const config = (node.config as unknown as VideoCompositorNodeConfig) ?? {};
		const layerUpdates = config.layerUpdates ?? {};

		const width = config.width ?? 1920;
		const height = config.height ?? 1080;
		const fps = config.FPS ?? FPS;

		// Build layers with virtualVideo references from connected Video inputs
		const layers: ExtendedLayer[] = [];
		let maxZ = 0;
		for (const update of Object.values(layerUpdates)) {
			maxZ = Math.max(maxZ, (update as ExtendedLayer).zIndex ?? 0);
		}

		let durationInFrames = fps * 5; // default minimum

		for (const [handleId, input] of Object.entries(inputs)) {
			if (!input?.connectionValid || !input.outputItem) continue;

			const saved = (layerUpdates[handleId] ?? {}) as Partial<ExtendedLayer>;
			const item = input.outputItem;

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
				durationInFrames: saved.durationInFrames ?? fps * 5,
				volume: saved.volume ?? 1,
				animations: saved.animations ?? [],
				width: saved.width ?? width,
				height: saved.height ?? height,
				...saved,
			};

			if (item.type === "Video") {
				const vv = item.data as VirtualVideoData;
				layer.virtualVideo = vv;
				if (!saved.durationInFrames) {
					const durMs = vv.sourceMeta?.durationMs ?? 0;
					layer.durationInFrames =
						durMs > 0 ? Math.ceil((durMs / 1000) * fps) : fps * 5;
				}
			}

			const layerEnd =
				(layer.startFrame ?? 0) + (layer.durationInFrames ?? fps * 5);
			if (layerEnd > durationInFrames) durationInFrames = layerEnd;

			layers.push(layer);
		}

		// Output VirtualVideoData with a compose operation
		const outputVV: VirtualVideoData = {
			source: { entity: undefined, processData: undefined },
			sourceMeta: {
				width,
				height,
				fps,
				durationMs: (durationInFrames / fps) * 1000,
			},
			operations: [
				{
					op: "compose",
					layers,
					width,
					height,
					fps,
					durationInFrames,
				},
			],
		};

		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) {
			return { selectedOutputIndex: 0, outputs: [] };
		}

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Video" as const,
							data: outputVV,
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}

export default defineClient(metadata, {
	Component: VideoCompositorNodeComponent,
	PageContentComponent: VideoCompositorView,
	mainIconComponent: PiFilmReelLight,
	processor: VideoCompositorBrowserProcessor,
});
