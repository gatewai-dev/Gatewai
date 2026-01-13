import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector } from "react-redux";
import { assetsAPI } from "./assets";
import { canvasDetailsAPI } from "./canvas";
import { canvasListAPI } from "./canvas-list";
import { edgesReducer } from "./edges";
import { fontListAPI } from "./fonts";
import { handlesReducer } from "./handles";
import { nodeMetaReducer } from "./node-meta";
import { nodeTemplatesAPI } from "./node-templates";
import { nodesReducer } from "./nodes";
import { reactFlowReducer } from "./rfstate";
import { tasksReducer } from "./tasks";
import { undoReducer } from "./undo-redo";

const flowReducer = combineReducers({
	nodes: nodesReducer,
	handles: handlesReducer,
	edges: edgesReducer,
	reactFlow: reactFlowReducer,
});

const undoableFlowReducer = undoReducer(flowReducer, {
	limit: 50,
	undoableActionTypes: [
		"reactFlow/nodesFinishedDragging",
		"reactFlow/createNode",
		"reactFlow/createEdge",
		"reactFlow/addConnection",

		"nodes/createNodeEntity",
		"nodes/updateNodeEntity",
		"nodes/updateNodeResult",
		"nodes/updateNodeConfig",
		"nodes/deleteManyNodeEntity",
		"nodes/deleteManyNodeEntity",

		"edges/createEdgeEntity",
		"edges/deleteManyEdgeEntity",

		"handles/createHandleEntity",
		"handles/deleteManyHandleEntity",
		"handles/addManyHandleEntities",
		"handles/updateHandleEntity",

		"flow/batched",
	],
});

import type { Middleware } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import { toast } from "sonner";

/**
 * Log a warning and show a toast!
 */
export const rtkQueryErrorLogger: Middleware = () => (next) => (action) => {
	// RTK Query uses `createAsyncThunk` from redux-toolkit under the hood, so we're able to utilize these matchers!
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
		flow: undoableFlowReducer,

		tasks: tasksReducer,
		nodeMeta: nodeMetaReducer,
		[nodeTemplatesAPI.reducerPath]: nodeTemplatesAPI.reducer,
		[assetsAPI.reducerPath]: assetsAPI.reducer,
		[canvasListAPI.reducerPath]: canvasListAPI.reducer,
		[canvasDetailsAPI.reducerPath]: canvasDetailsAPI.reducer,
		[fontListAPI.reducerPath]: fontListAPI.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware()
			.concat(nodeTemplatesAPI.middleware)
			.concat(assetsAPI.middleware)
			.concat(canvasListAPI.middleware)
			.concat(fontListAPI.middleware)
			.concat(canvasDetailsAPI.middleware)
			.concat(rtkQueryErrorLogger),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
