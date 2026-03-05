import type { ExtendedLayer, VirtualMediaData } from "../types/index.js";

export type RenderMediaProgress = {
	renderedFrames: number;
	encodedFrames: number;
	encodedDoneIn: number | null;
	renderedDoneIn: number | null;
	renderEstimatedTime: number;
	progress: number;
};

export interface SceneProps {
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	containerWidth?: number;
	containerHeight?: number;
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "SVG" | "Text" | string;
	data?: unknown;
	virtualMedia?: VirtualMediaData;
	durationInMS?: number;
	backgroundColor?: string;
	[key: string]: unknown;
}

export type RenderMediaOnProgress = (progress: RenderMediaProgress) => void;

export interface VideoRenderOptions {
	compositionId: string;
	inputProps: SceneProps;
	width: number;
	height: number;
	fps: number;
	durationInFrames: number;
	codec?: "h264" | "h265" | "vp8" | "vp9";
	/** Render from this time (inclusive). Omit to start from beginning. */
	startMS?: number;
	/** Render up to this time (exclusive). Omit to render until end. */
	endMS?: number;
	onProgress?: RenderMediaOnProgress;
	envVariables?: Record<string, string>;
}

export interface IVideoRendererService {
	renderComposition(options: VideoRenderOptions): Promise<{ filePath: string }>;
}
