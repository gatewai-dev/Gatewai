// types.ts
import type { ModulateNodeConfig, PaintNodeConfig } from "@gatewai/types";

export interface IPixiProcessor {
	processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		// AbortSignal is handled on the caller side for Workers
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }>;

	processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }>;

	processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }>;

	processCrop(
		imageUrl: string,
		options: {
			leftPercentage: number;
			topPercentage: number;
			widthPercentage: number;
			heightPercentage: number;
		},
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }>;

	processMask(
		config: PaintNodeConfig,
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
	): Promise<{
		imageWithMask: { dataUrl: string; width: number; height: number };
		onlyMask: { dataUrl: string; width: number; height: number };
	}>;
}
