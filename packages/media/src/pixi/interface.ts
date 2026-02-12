import type {} from "@gatewai/core/types";
import type { PixiProcessor } from "./types";

export interface IPixiProcessor {
	registerProcessor(processor: PixiProcessor): void;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	processImage(
		imageUrl: string,
		operations: (
			app: any,
			sprite: any,
			resources: {
				Filter: any;
				Sprite: any;
				Container: any;
				Graphics: any;
				[key: string]: unknown;
			},
		) => Promise<void> | void,
		apiKey?: string,
	): Promise<Blob>;

	createTexture(url: string, apiKey?: string): Promise<any>;

	extract(target: any, renderer: any): Promise<Blob>;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	execute<TInput = any, TOutput = any>(
		id: string,
		input: TInput,
		signal?: AbortSignal,
	): Promise<TOutput>;

	processModulate(
		imageUrl: string,
		config: {
			hue: number;
			saturation: number;
			lightness: number;
			brightness: number;
		},
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
		config: {
			width: number;
			height: number;
			maintainAspect: boolean;
			aspectRatio?: number | undefined;
			backgroundColor?: string | undefined;
			paintData?: string | undefined;
		},
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{
		imageWithMask: { dataUrl: Blob; width: number; height: number };
		onlyMask: { dataUrl: Blob; width: number; height: number };
	}>;
}
