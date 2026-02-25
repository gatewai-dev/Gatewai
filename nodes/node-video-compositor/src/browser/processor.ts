import type {
	ExtendedLayer,
	NodeProcessorParams,
	VirtualVideoData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	createVirtualVideo,
	getActiveVideoMetadata,
} from "@gatewai/remotion-compositions";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { DEFAULT_DURATION_FRAMES, FPS } from "./video-editor/config/index.js";

export class VideoCompositorBrowserProcessor implements IBrowserProcessor {
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

		let durationInFrames = DEFAULT_DURATION_FRAMES; // default minimum

		// Build recursive VirtualVideoData
		const compositionChildren: VirtualVideoData[] = [];

		for (const [handleId, input] of Object.entries(inputs)) {
			if (!input?.connectionValid || !input.outputItem) continue;

			const saved = (layerUpdates[handleId] ?? {}) as Partial<ExtendedLayer>;
			const item = input.outputItem;

			let childVV: VirtualVideoData;

			if (item.type === "Video" || item.type === "Audio") {
				childVV = item.data as VirtualVideoData;
			} else if (item.type === "Image") {
				childVV = createVirtualVideo(item.data, item.type);
			} else if (item.type === "Text") {
				childVV = createVirtualVideo(item.data, "Text");
			} else {
				continue;
			}
			console.log({ childVV });
			const activeMeta = getActiveVideoMetadata(childVV);

			const layerDurationInFrames =
				saved.durationInFrames ??
				Math.ceil(((activeMeta.durationMs ?? 0) / 1000) * fps);

			// Wrap in a layer operation
			const layerOp: VirtualVideoData = {
				metadata: {
					...activeMeta,
					width: saved.width ?? activeMeta.width,
					height: saved.height ?? activeMeta.height,
					durationMs: (layerDurationInFrames / fps) * 1000,
				},
				operation: {
					op: "layer",
					x: saved.x ?? 0,
					y: saved.y ?? 0,
					width: saved.width ?? activeMeta.width,
					height: saved.height ?? activeMeta.height,
					rotation: saved.rotation ?? 0,
					scale: saved.scale ?? 1,
					opacity: saved.opacity ?? 1,
					startFrame: saved.startFrame ?? 0,
					durationInFrames: layerDurationInFrames,
					zIndex: saved.zIndex ?? 0,
					// Content & Styling
					text: saved.text,
					fontSize: saved.fontSize,
					fontFamily: saved.fontFamily,
					fontStyle: saved.fontStyle,
					fontWeight: saved.fontWeight,
					textDecoration: saved.textDecoration,
					fill: saved.fill,
					align: saved.align,
					verticalAlign: saved.verticalAlign,
					letterSpacing: saved.letterSpacing,
					lineHeight: saved.lineHeight,
					padding: saved.padding,
					stroke: saved.stroke,
					strokeWidth: saved.strokeWidth,
					backgroundColor: saved.backgroundColor,
					borderColor: saved.borderColor,
					borderWidth: saved.borderWidth,
					borderRadius: saved.borderRadius,
					autoDimensions: saved.autoDimensions,
				},
				children: [childVV],
			};

			const layerEnd =
				(layerOp.operation as any).startFrame +
				((layerOp.operation as any).durationInFrames ??
					DEFAULT_DURATION_FRAMES);
			if (layerEnd > durationInFrames) durationInFrames = layerEnd;

			compositionChildren.push(layerOp);
		}

		// Output VirtualVideoData with a compose operation
		const outputVV: VirtualVideoData = {
			metadata: {
				width,
				height,
				fps,
				durationMs: (durationInFrames / fps) * 1000,
			},
			operation: {
				op: "compose",
				width,
				height,
				fps,
				durationInFrames,
			},
			children: compositionChildren,
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
