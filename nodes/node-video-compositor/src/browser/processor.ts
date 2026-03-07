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

/**
 * Resolves the final duration of a layer cleanly by capping the requested layer
 * duration to the maximum allowable duration defined by intrinsic virtual media metadata.
 * Matches logic in packages/remotion-compositions/src/compositions/scene.tsx
 */
const resolveLayerDuration = (
	layerDurationInMS?: number | null,
	metaDurationMs?: number | null,
	defaultDuration: number = DEFAULT_DURATION_MS,
): number => {
	if (layerDurationInMS && metaDurationMs) {
		return Math.min(layerDurationInMS, metaDurationMs);
	}
	return layerDurationInMS || metaDurationMs || defaultDuration;
};

export class VideoCompositorBrowserProcessor implements IBrowserProcessor {
	async process({ node, inputs, context }: NodeProcessorParams) {
		// Robust config parsing: handles stringified JSON or hoisted node properties
		let rawConfig = node.config;
		if (typeof rawConfig === "string") {
			try {
				rawConfig = JSON.parse(rawConfig);
			} catch (e) {
				rawConfig = {};
			}
		}

		const config = (rawConfig as unknown as VideoCompositorNodeConfig) ?? {};
		// Fallback to node properties if they were directly attached (common in unstructured node graphs)
		const layerUpdates =
			config.layerUpdates ?? (node as any).layerUpdates ?? {};

		const width = config.width ?? (node as any).width ?? 1080;
		const height = config.height ?? (node as any).height ?? 1080;
		const fps = config.FPS ?? (node as any).FPS ?? 24;
		const backgroundColor =
			config.backgroundColor ?? (node as any).backgroundColor ?? "#000000";

		let durationInMS = 0;
		const processedHandleIds = new Set<string>();

		// Build recursive VirtualMediaData and refine durationInMS with metadata
		const compositionChildren: VirtualMediaData[] = [];

		for (const [handleId, input] of Object.entries(inputs)) {
			if (!input?.connectionValid || !input.outputItem) continue;

			processedHandleIds.add(handleId);
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

			// layerDurationInMS is used for the layer operation (media-capped, for correct playback).
			const layerDurationInMS = resolveLayerDuration(
				saved.durationInMS,
				activeMeta?.durationMs,
			);

			const timelineDurationInMS =
				saved.durationInMS ?? activeMeta?.durationMs ?? DEFAULT_DURATION_MS;

			// Update total composition duration using the timeline-accurate value
			const layerEnd =
				((saved.startFrame ?? 0) / fps) * 1000 + timelineDurationInMS;
			if (layerEnd > durationInMS) durationInMS = layerEnd;

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

			compositionChildren.push(layerOp);
		}

		// Also check duration of layers in layerUpdates that were NOT in inputs
		// (disconnected but still present in the timeline).
		for (const update of Object.values(layerUpdates)) {
			const layer = update as ExtendedLayer;
			const layerDuration = layer.durationInMS ?? DEFAULT_DURATION_MS;
			const layerEnd = ((layer.startFrame ?? 0) / fps) * 1000 + layerDuration;
			if (layerEnd > durationInMS) durationInMS = layerEnd;
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
