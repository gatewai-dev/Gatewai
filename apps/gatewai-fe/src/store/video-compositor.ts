import {
	createEntityAdapter,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import type { ExtendedLayer } from "@/modules/video-editor/common/composition";
import { DEFAULT_DURATION_FRAMES, FPS } from "@/modules/video-editor/config";
import type { VideoEditorState } from "@/modules/video-editor/types";

// --- Adapter (Normalization) ---
// This handles ID-based lookups and updates automatically.
const layersAdapter = createEntityAdapter<ExtendedLayer>({
	selectId: (layer: ExtendedLayer) => layer.id,
	// Sort by zIndex for rendering order consistency
	sortComparer: (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
});

// --- Initial State ---
const initialState: VideoEditorState = {
	layers: layersAdapter.getInitialState(),
	selectedId: null,
	isDirty: false,
	canvas: {
		width: 1280, // Default, will be overridden by init
		height: 720,
		zoom: 0.5,
		pan: { x: 0, y: 0 },
		mode: "select",
	},
	playback: {
		isPlaying: false,
		currentFrame: 0,
		durationInFrames: DEFAULT_DURATION_FRAMES,
		fps: FPS,
	},
};

// --- Slice ---
const videoEditorSlice = createSlice({
	name: "editor",
	initialState,
	reducers: {
		// -- Layer Management --
		initializeLayers: (state, action: PayloadAction<ExtendedLayer[]>) => {
			layersAdapter.setAll(state.layers, action.payload);
			state.playback.durationInFrames = calculateDuration(action.payload);
			state.isDirty = false;
		},
		addLayer: (state, action: PayloadAction<ExtendedLayer>) => {
			layersAdapter.addOne(state.layers, action.payload);
			state.playback.durationInFrames = calculateDuration(
				Object.values(state.layers.entities) as ExtendedLayer[],
			);
			state.isDirty = true;
		},
		updateLayer: (
			state,
			action: PayloadAction<{ id: string; changes: Partial<ExtendedLayer> }>,
		) => {
			layersAdapter.updateOne(state.layers, action.payload);
			// Recalculate duration if timing changed
			if (
				action.payload.changes.startFrame !== undefined ||
				action.payload.changes.durationInFrames !== undefined
			) {
				state.playback.durationInFrames = calculateDuration(
					Object.values(state.layers.entities) as ExtendedLayer[],
				);
			}
			state.isDirty = true;
		},
		updateLayers: (state, action: PayloadAction<ExtendedLayer[]>) => {
			// Batch update for performance (e.g. dragging multiple or reordering)
			layersAdapter.upsertMany(state.layers, action.payload);
			state.playback.durationInFrames = calculateDuration(
				Object.values(state.layers.entities) as ExtendedLayer[],
			);
			state.isDirty = true;
		},
		removeLayer: (state, action: PayloadAction<string>) => {
			layersAdapter.removeOne(state.layers, action.payload);
			if (state.selectedId === action.payload) {
				state.selectedId = null;
			}
			state.isDirty = true;
		},
		reorderLayers: (
			state,
			action: PayloadAction<{ id: string; zIndex: number }[]>,
		) => {
			const updates = action.payload.map(({ id, zIndex }) => ({
				id,
				changes: { zIndex },
			}));
			layersAdapter.updateMany(state.layers, updates);
			state.isDirty = true;
		},

		// -- Selection --
		setSelectedId: (state, action: PayloadAction<string | null>) => {
			state.selectedId = action.payload;
		},

		// -- Canvas --
		setCanvasDimensions: (
			state,
			action: PayloadAction<{ width: number; height: number }>,
		) => {
			state.canvas.width = action.payload.width;
			state.canvas.height = action.payload.height;
			state.isDirty = true;
		},
		setZoom: (state, action: PayloadAction<number>) => {
			state.canvas.zoom = action.payload;
		},
		setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
			state.canvas.pan = action.payload;
		},
		setToolMode: (state, action: PayloadAction<"select" | "pan">) => {
			state.canvas.mode = action.payload;
		},

		// -- Playback --
		setIsPlaying: (state, action: PayloadAction<boolean>) => {
			state.playback.isPlaying = action.payload;
		},
		setCurrentFrame: (state, action: PayloadAction<number>) => {
			state.playback.currentFrame = action.payload;
		},
		resetDirty: (state) => {
			state.isDirty = false;
		},
	},
});

function calculateDuration(layers: ExtendedLayer[]) {
	if (layers.length === 0) return DEFAULT_DURATION_FRAMES;
	return Math.max(
		DEFAULT_DURATION_FRAMES,
		...layers.map(
			(l) =>
				(l.startFrame || 0) + (l.durationInFrames ?? DEFAULT_DURATION_FRAMES),
		),
	);
}

export const {
	selectAll: selectAllLayers,
	selectById: selectLayerById,
	selectEntities: selectLayerEntities,
} = layersAdapter.getSelectors(
	(state: { videoEditor: VideoEditorState }) => state.videoEditor.layers,
);

export const selectVideoEditorState = (state: {
	videoEditor: VideoEditorState;
}) => state.videoEditor;
export const selectCanvas = (state: { videoEditor: VideoEditorState }) =>
	state.videoEditor.canvas;
export const selectPlayback = (state: { videoEditor: VideoEditorState }) =>
	state.videoEditor.playback;
export const selectSelectedLayerId = (state: {
	videoEditor: VideoEditorState;
}) => state.videoEditor.selectedId;
export const selectIsDirty = (state: { videoEditor: VideoEditorState }) =>
	state.videoEditor.isDirty;

export const {
	initializeLayers,
	addLayer,
	updateLayer,
	updateLayers,
	removeLayer,
	reorderLayers,
	setSelectedId,
	setCanvasDimensions,
	setZoom,
	setPan,
	setToolMode,
	setIsPlaying,
	setCurrentFrame,
	resetDirty,
} = videoEditorSlice.actions;

const { reducer: videoEditorReducer } = videoEditorSlice;

export { videoEditorReducer };
