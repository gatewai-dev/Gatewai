import { BlurFilter } from "pixi.js";

/**
 * Configuration for the SharpBlurFilter.
 * Matches sharp's API where `sigma` is the primary control.
 */
export interface BlurNodeConfig {
	/** * The sigma of the Gaussian mask.
	 * Matches sharp's `blur(sigma)`.
	 * Default: 0 (no blur)
	 */
	sigma?: number;
}

/**
 * Perceptually accurate Blur Filter for PIXI.js
 * Mimics Node 'sharp' behavior using Gaussian Blur with clamped edges.
 */
class SharpBlurFilter extends BlurFilter {
	constructor(config: BlurNodeConfig) {
		// Initialize with default strength 0
		super({ strength: 0, kernelSize: 13 });

		// 1. Match Sharp's Edge Behavior
		// Sharp extends/clamps edge pixels rather than fading to transparent/black.
		this.repeatEdgePixels = true;

		// 2. Match Sharp's Quality
		// Sharp uses high-precision math. Pixi defaults to quality 4.
		// We boost this to ensure the Gaussian curve is smooth at higher sigmas.
		this.quality = 8;

		// 3. Apply Sigma
		if (config.sigma) {
			this.sigma = config.sigma;
		}
	}

	/**
	 * Set the blur "Sigma".
	 * In Pixi, 'strength' roughly correlates to the blur radius (px).
	 * In Gaussian theory, Radius ≈ 2 * Sigma to 3 * Sigma.
	 * * However, for visual parity with Sharp/CSS:
	 * A direct mapping of Sigma -> Strength provides the closest visual match
	 * because Pixi's internal kernel size calculation scales with strength.
	 */
	get sigma(): number {
		return this.blur;
	}

	set sigma(value: number) {
		// Pixi's 'blur' property sets both X and Y strength simultaneously
		this.blur = value;
	}
}

export { SharpBlurFilter };
