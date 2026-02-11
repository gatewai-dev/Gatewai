import {
	createAsyncThunk,
	createEntityAdapter,
	createSelector,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { createRpcClient } from "@gatewai/rpc-client";

const rpcClient = createRpcClient();
import type {
	ActiveCanvasBatchListRPC,
	BatchDetailsRPC,
	BatchDetailsRPCParams,
} from "@gatewai/rpc-client";
import type { RootState } from "./";

export type BatchEntity = BatchDetailsRPC[number];
export type BatchNodeData = BatchEntity["tasks"][number];

export const batchAdapter = createEntityAdapter<BatchEntity>();

export const getBatchDetails = createAsyncThunk<
	BatchDetailsRPC,
	BatchDetailsRPCParams
>("tasks/getBatchDetails", async (params) => {
	const response = await rpcClient.api.v1.tasks["filterby-batch"].$get(params);
	if (!response.ok) {
		throw new Error(await response.text());
	}
	return await response.json();
});

export const getInitialBatches = createAsyncThunk<
	ActiveCanvasBatchListRPC,
	{ canvasId: string }
>("tasks/getInitialBatches", async ({ canvasId }) => {
	const response = await rpcClient.api.v1.tasks[":canvasId"].$get({
		param: {
			canvasId,
		},
		query: {
			taskStatus: ["QUEUED", "EXECUTING"],
		},
	});
	if (!response.ok) {
		throw new Error(await response.text());
	}
	return await response.json();
});

type TasksState = ReturnType<typeof batchAdapter.getInitialState> & {
	pollingInterval: number;
	batchIdsToPoll: string[];
	initialLoading: boolean;
	latestTasksFetchTime: number | null;
};

const initialState: TasksState = batchAdapter.getInitialState<TasksState>({
	pollingInterval: 0,
	batchIdsToPoll: [],
	ids: [],
	entities: {},
	initialLoading: false,
	latestTasksFetchTime: null,
});

const tasksSlice = createSlice({
	name: "tasks",
	initialState,
	reducers: {
		setPollingInterval: (state, action: PayloadAction<number>) => {
			state.pollingInterval = action.payload;
		},
		addBatchToPoll: (state, action: PayloadAction<BatchEntity>) => {
			const batch = action.payload;
			batchAdapter.upsertOne(state, batch);
			if (!state.batchIdsToPoll.includes(batch.id)) {
				state.batchIdsToPoll.push(batch.id);
			}
			state.pollingInterval = 3000;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(getInitialBatches.pending, (state) => {
				state.initialLoading = true;
			})
			.addCase(getInitialBatches.rejected, (state) => {
				state.initialLoading = false;
			})
			.addCase(getInitialBatches.fulfilled, (state, action) => {
				const batches = action.payload;
				batchAdapter.upsertMany(
					state,
					action.payload.filter((b): b is BatchEntity => b !== null),
				);
				const runningBatchIds = batches
					.filter((f) => f.finishedAt == null)
					.map((b) => b.id);
				state.batchIdsToPoll = [
					...new Set([...state.batchIdsToPoll, ...runningBatchIds]),
				];
				if (runningBatchIds.length > 0) {
					state.pollingInterval = 3000;
				} else {
					state.pollingInterval = 0;
				}
				state.initialLoading = false;
				state.latestTasksFetchTime = Date.now();
			})
			.addCase(getBatchDetails.fulfilled, (state, action) => {
				const batches = action.payload;
				batchAdapter.upsertMany(
					state,
					batches.filter((b): b is BatchEntity => b !== null),
				);
				const runningBatchIds = batches
					.filter((f) => f.finishedAt == null)
					.map((b) => b.id);
				state.batchIdsToPoll = [
					...new Set([...state.batchIdsToPoll, ...runningBatchIds]),
				];
				if (runningBatchIds.length > 0) {
					state.pollingInterval = 3000;
				} else {
					state.pollingInterval = 0;
				}
				state.initialLoading = false;
				state.latestTasksFetchTime = Date.now();
			});
	},
});

export const { setPollingInterval, addBatchToPoll } = tasksSlice.actions;

export const tasksReducer = tasksSlice.reducer;

export const selectTasksState = (state: RootState) => state.tasks;

const batchSelectors = batchAdapter.getSelectors<RootState>(selectTasksState);

export const selectPollingInterval: (state: RootState) => number =
	createSelector(selectTasksState, (tasks) => tasks.pollingInterval);

export const selectBatchIdsToPoll: (state: RootState) => string[] =
	createSelector(selectTasksState, (t) => t.batchIdsToPoll);

export const selectLatestTasksFetchTime: (state: RootState) => number | null =
	createSelector(selectTasksState, (tasks) => tasks.latestTasksFetchTime);

export const selectInitialLoading: (state: RootState) => boolean =
	createSelector(selectTasksState, (tasks) => tasks.initialLoading);

export const selectAllBatches = batchSelectors.selectAll;

export const selectNodeTaskStatus = createSelector(
	(state: RootState) => batchSelectors.selectAll(state),
	(batches) => {
		const status: Record<string, BatchNodeData[]> = {};
		batches.forEach((batch) => {
			batch.tasks.forEach((task) => {
				if (task.nodeId) {
					if (status[task.nodeId]) {
						status[task.nodeId].push(task);
					} else {
						status[task.nodeId] = [task];
					}
				}
			});
		});
		return status;
	},
) as (state: RootState) => Record<string, BatchNodeData[]>;
