import type { Middleware } from "@reduxjs/toolkit";
import { configureStore, isRejectedWithValue } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { agentSessionsAPI } from "./agent-sessions.js";
import { apiKeysAPI } from "./api-keys.js";
import { assetsAPI } from "./assets.js";
import { canvasDetailsAPI } from "./canvas.js";
import { canvasListAPI } from "./canvas-list.js";
import { canvasPatchesReducer } from "./canvas-patches.js";
import { edgesReducer } from "./edges.js";
import { fontListAPI } from "./fonts.js";
import { handlesReducer } from "./handles.js";
import { nodeMetaReducer } from "./node-meta.js";
import { nodeTemplatesAPI } from "./node-templates.js";
import { nodesReducer } from "./nodes.js";
import { reactFlowReducer } from "./rfstate.js";
import { tasksReducer } from "./tasks.js";

export * from "@gatewai/rpc-client";
export * from "react-redux";
export * from "./agent-sessions.js";
export * from "./api-keys.js";
export * from "./assets.js";
export * from "./canvas.js";
export * from "./canvas-list.js";
export * from "./canvas-patches.js";
export * from "./edges.js";
export * from "./fonts.js";
export * from "./handles.js";
export * from "./node-meta.js";
export * from "./node-templates.js";
export * from "./nodes.js";
export * from "./rfstate.js";
export * from "./tasks.js";
/**
 * Log a warning and show a toast!
 */
export const rtkQueryErrorLogger: Middleware = () => (next) => (action) => {
	if (isRejectedWithValue(action)) {
		console.warn("We got a rejected action!");
		toast.error(
			"data" in action.error
				? (action.error.data as { message: string }).message
				: action.error.message,
		);
	}

	return next(action);
};

export const store = configureStore({
	reducer: {
		nodes: nodesReducer,
		handles: handlesReducer,
		edges: edgesReducer,
		reactFlow: reactFlowReducer,
		canvasPatches: canvasPatchesReducer,
		tasks: tasksReducer,
		nodeMeta: nodeMetaReducer,
		[nodeTemplatesAPI.reducerPath]: nodeTemplatesAPI.reducer,
		[assetsAPI.reducerPath]: assetsAPI.reducer,
		[canvasListAPI.reducerPath]: canvasListAPI.reducer,
		[canvasDetailsAPI.reducerPath]: canvasDetailsAPI.reducer,
		[fontListAPI.reducerPath]: fontListAPI.reducer,
		[agentSessionsAPI.reducerPath]: agentSessionsAPI.reducer,
		[apiKeysAPI.reducerPath]: apiKeysAPI.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware()
			.concat(nodeTemplatesAPI.middleware)
			.concat(assetsAPI.middleware)
			.concat(canvasListAPI.middleware)
			.concat(fontListAPI.middleware)
			.concat(canvasDetailsAPI.middleware)
			.concat(rtkQueryErrorLogger)
			.concat(agentSessionsAPI.middleware)
			.concat(apiKeysAPI.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
