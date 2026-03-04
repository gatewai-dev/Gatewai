import type {
	ExtendedLayer,
	NodeProcessorParams,
	VirtualMediaData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	createVirtualMedia,
	getActiveMediaMetadata,
} from "@gatewai/remotion-compositions";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { DEFAULT_DURATION_MS } from "./video-editor/config/index.js";

export class VideoCompositorBrowserProcessor implements IBrowserProcessor {
	async process({ node, inputs, context }: NodeProcessorParams) {
		const config = (node.config as unknown as VideoCompositorNodeConfig) ?? {};
		const layerUpdates = config.layerUpdates ?? {};

		const width = config.width ?? 1080;
		const height = config.height ?? 1080;
		const fps = config.FPS ?? 24;
		const backgroundColor = config.backgroundColor ?? "#000000";

		// Build layers with virtualMedia references from connected Video inputs
		const layers: ExtendedLayer[] = [];
		let maxZ = 0;
		for (const update of Object.values(layerUpdates)) {
			maxZ = Math.max(maxZ, (update as ExtendedLayer).zIndex ?? 0);
		}

		let durationInMS = 0; // Starts at 0, will expand based on layers

		// Build recursive VirtualMediaData
		const compositionChildren: VirtualMediaData[] = [];

		for (const [handleId, input] of Object.entries(inputs)) {
			if (!input?.connectionValid || !input.outputItem) continue;

			const saved = (layerUpdates[handleId] ?? {}) as Partial<ExtendedLayer>;
			const item = input.outputItem;

			let childVV: VirtualMediaData;
			let sourceText: string | undefined;

			if (item.type === "Video" || item.type === "Audio") {
				childVV = item.data as VirtualMediaData;
			} else if (item.type === "Image" || item.type === "SVG") {
				childVV = createVirtualMedia(item.data, item.type);
			} else if (item.type === "Text") {
				sourceText = (item.data as string) || "";
				childVV = createVirtualMedia(item.data, "Text");
			} else if (item.type === "Caption") {
				childVV = createVirtualMedia(item.data, "Caption");
			} else {
				continue;
			}
			const activeMeta = getActiveMediaMetadata(childVV);

			const layerDurationInMS =
				saved.durationInMS ?? (activeMeta ? (activeMeta.durationMs ?? 0) : 0);

			// Wrap in a layer operation
			const layerOpWidth = saved.width ?? activeMeta?.width ?? width;
			const layerOpHeight = saved.height ?? activeMeta?.height ?? height;

			const layerOp: VirtualMediaData = {
				metadata: {
					...activeMeta,
					width: layerOpWidth,
					height: layerOpHeight,
					durationMs: layerDurationInMS,
				},
				operation: {
					op: "layer",
					x: saved.x ?? 0,
					y: saved.y ?? 0,
					width: layerOpWidth,
					height: layerOpHeight,
					rotation: saved.rotation ?? 0,
					scale: saved.scale ?? 1,
					opacity: saved.opacity ?? 1,
					startFrame: saved.startFrame ?? 0,
					durationInMS: layerDurationInMS,
					zIndex: saved.zIndex ?? 0,
					// Content & Styling
					text: item.type === "Text" ? sourceText : saved.text,
					fontSize: saved.fontSize ?? (item.type === "Text" ? 60 : undefined),
					fontFamily:
						saved.fontFamily ?? (item.type === "Text" ? "Inter" : undefined),
					fontStyle: saved.fontStyle,
					fontWeight: saved.fontWeight,
					textDecoration: saved.textDecoration,
					fill: saved.fill ?? (item.type === "Text" ? "#ffffff" : undefined),
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
					animations: saved.animations,
					speed: saved.speed,
					captionPreset: saved.captionPreset,
					useRoundedTextBox: saved.useRoundedTextBox,
				},
				children: [childVV],
			};

			const layerEnd =
				((saved.startFrame ?? 0) / fps) * 1000 +
				(layerDurationInMS ?? DEFAULT_DURATION_MS);
			if (layerEnd > durationInMS) durationInMS = layerEnd;

			compositionChildren.push(layerOp);
		}

		// Output VirtualMediaData with a compose operation
		const outputVV: VirtualMediaData = {
			metadata: {
				width,
				height,
				fps,
				durationMs: durationInMS,
			},
			operation: {
				op: "compose",
				width,
				height,
				fps,
				backgroundColor,
				metadata: {
					durationMs: durationInMS,
					width,
					height,
					fps,
				},
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
