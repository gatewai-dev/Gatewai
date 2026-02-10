import type { ModulateNodeConfig, PaintNodeConfig } from "@gatewai/types";
import type { PixiProcessor } from "./types";

export interface IPixiProcessor {
	registerProcessor(processor: PixiProcessor): void;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	execute<TInput = any, TOutput = any>(
		id: string,
		input: TInput,
		signal?: AbortSignal,
	): Promise<TOutput>;

	processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processCrop(
		imageUrl: string,
		options: {
			leftPercentage: number;
			topPercentage: number;
			widthPercentage: number;
			heightPercentage: number;
		},
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processMask(
		config: PaintNodeConfig,
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{
		imageWithMask: { dataUrl: Blob; width: number; height: number };
		onlyMask: { dataUrl: Blob; width: number; height: number };
	}>;
}
