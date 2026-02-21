import type { ExtendedLayer } from "@gatewai/core/types";
import type React from "react";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LayerRenderer } from "./layer-renderer.js";

export interface SceneProps {
	layers: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
}

/**
 * CompositionScene — renders an ordered list of ExtendedLayer objects.
 * Used by the Video Compositor node preview and in SingleClipComposition
 * when a `compose` operation is encountered.
 */
export const CompositionScene: React.FC<SceneProps> = ({
	layers,
	viewportWidth,
	viewportHeight,
}) => {
	const frame = useCurrentFrame();

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000000" }}>
			{sortedLayers.map((layer) => {
				const startFrame = layer.startFrame ?? 0;
				const duration = layer.durationInFrames ?? 120;
				const endFrame = startFrame + duration;

				// Skip layers that aren't active at this frame
				if (frame < startFrame || frame >= endFrame) return null;

				return (
					<LayerRenderer
						key={layer.id}
						layer={layer}
						viewport={{ w: viewportWidth, h: viewportHeight }}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
