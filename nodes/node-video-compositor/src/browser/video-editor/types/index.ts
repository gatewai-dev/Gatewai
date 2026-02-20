import type { EntityState } from "@reduxjs/toolkit";
import type { ExtendedLayer } from "../common/composition.js";

export interface CanvasState {
	width: number;
	height: number;
	zoom: number;
	pan: { x: number; y: number };
	mode: "select" | "pan";
}

export interface PlaybackState {
	isPlaying: boolean;
	currentFrame: number;
	durationInFrames: number;
	fps: number;
}

export interface VideoEditorState {
	layers: EntityState<ExtendedLayer, string>; // Normalized Entity State
	selectedId: string | null;
	canvas: CanvasState;
	playback: PlaybackState;
	isDirty: boolean;
}
