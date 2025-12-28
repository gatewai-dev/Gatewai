import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector } from "react-redux";
import { assetsAPI } from "./assets";
import { canvasDetailsAPI } from "./canvas";
import { canvasListAPI } from "./canvas-list";
import { edgesReducer } from "./edges";
import { handlesReducer } from "./handles";
import { nodeTemplatesAPI } from "./node-templates";
import { nodesReducer } from "./nodes";
import { reactFlowReducer } from "./rfstate";
import { tasksReducer } from "./tasks";

export const store = configureStore({
	reducer: {
		nodes: nodesReducer,
		handles: handlesReducer,
		edges: edgesReducer,
		reactFlow: reactFlowReducer,
		tasks: tasksReducer,
		[nodeTemplatesAPI.reducerPath]: nodeTemplatesAPI.reducer,
		[assetsAPI.reducerPath]: assetsAPI.reducer,
		[canvasListAPI.reducerPath]: canvasListAPI.reducer,
		[canvasDetailsAPI.reducerPath]: canvasDetailsAPI.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware()
			.concat(nodeTemplatesAPI.middleware)
			.concat(assetsAPI.middleware)
			.concat(canvasListAPI.middleware)
			.concat(canvasDetailsAPI.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
