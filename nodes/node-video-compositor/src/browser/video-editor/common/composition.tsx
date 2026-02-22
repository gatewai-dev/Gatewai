import {
	CompositionScene as SharedCompositionScene,
	calculateLayerTransform as sharedCalculateLayerTransform,
} from "@gatewai/react-canvas";
import type {
	AnimationType as SharedAnimationType,
	VideoAnimation as SharedVideoAnimation,
	ExtendedLayer as SharedExtendedLayer,
} from "@gatewai/core/types";

export type AnimationType = SharedAnimationType;
export type VideoAnimation = SharedVideoAnimation;
export type ExtendedLayer = SharedExtendedLayer;

export const calculateLayerTransform = sharedCalculateLayerTransform;
export const CompositionScene = SharedCompositionScene;

export interface SceneProps {
	layers: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
}