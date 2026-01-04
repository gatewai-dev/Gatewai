import {
	createAsyncThunk,
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { rpcClient } from "@/rpc/client";
import type { BatchDetailsRPC, BatchDetailsRPCParams } from "@/rpc/types";
import type { RootState } from "@/store"; // Adjust based on your store setup

export type BatchEntity = BatchDetailsRPC["batches"][number];
export type BatchNodeData = BatchEntity["tasks"][number];

export const batchAdapter = createEntityAdapter<BatchEntity>({
	selectId: (batch: BatchEntity) => batch.id,
});

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
	BatchDetailsRPC,
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
};

const initialState: TasksState = batchAdapter.getInitialState<TasksState>({
	pollingInterval: 0,
	batchIdsToPoll: [],
	ids: [],
	entities: {},
	initialLoading: false,
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
				const { batches } = action.payload;
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
			})
			.addCase(getBatchDetails.fulfilled, (state, action) => {
				const { batches } = action.payload;
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
			});
	},
});

export const { setPollingInterval, addBatchToPoll } = tasksSlice.actions;

export const tasksReducer = tasksSlice.reducer;

export const selectTasksState = (state: RootState) => state.tasks;

export const batchSelectors = batchAdapter.getSelectors(selectTasksState);

export const selectPollingInterval = createDraftSafeSelector(
	selectTasksState,
	(tasks) => tasks.pollingInterval,
);

export const selectBatchIdsToPoll = createDraftSafeSelector(
	selectTasksState,
	(tasks) => tasks.batchIdsToPoll,
);

export const selectInitialLoading = createDraftSafeSelector(
	selectTasksState,
	(tasks) => tasks.initialLoading,
);

export const selectNodeTaskStatus = createDraftSafeSelector(
	batchSelectors.selectAll,
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
);
