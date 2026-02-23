/**
 * Local re-export for CompositionScene and related rendering utilities.
 *
 * The key addition here is CropAwareCompositionScene which intercepts video
 * layers that carry `videoCropOffsetX/Y` and `videoNaturalWidth/Height`
 * properties (populated by VideoDesignerEditor.loadInitialLayers) and renders
 * them with the correct overflow:hidden + absolute-offset pattern so only the
 * intended crop region is visible in the preview.
 *
 * For all other layer types the shared CompositionScene is used unchanged.
 */

import type {
	AnimationType as SharedAnimationType,
	ExtendedLayer as SharedExtendedLayer,
	VideoAnimation as SharedVideoAnimation,
} from "@gatewai/core/types";
import { calculateLayerTransform as sharedCalculateLayerTransform } from "@gatewai/react-canvas";

export type AnimationType = SharedAnimationType;
export type VideoAnimation = SharedVideoAnimation;
export type ExtendedLayer = SharedExtendedLayer;

export const calculateLayerTransform = sharedCalculateLayerTransform;

export interface SceneProps {
	layers: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
}
