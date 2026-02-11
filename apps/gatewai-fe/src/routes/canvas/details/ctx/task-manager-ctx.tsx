import type { Canvas, Node } from "@gatewai/db";
import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { useAnimatedFavicon } from "@/hooks/use-animated-favicon";
import type { BatchDetailsRPC, BatchDetailsRPCParams } from "@gatewai/react-store";
import { useAppDispatch, useAppSelector } from "@gatewai/react-store";
import { assetsAPI } from "@gatewai/react-store";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	addBatchToPoll,
	getBatchDetails,
	getInitialBatches,
	selectAllBatches,
	selectBatchIdsToPoll,
	selectInitialLoading,
	selectLatestTasksFetchTime,
	selectNodeTaskStatus,
	selectPollingInterval,
	setPollingInterval,
} from "@gatewai/react-store";

type BatchEntity = BatchDetailsRPC[number];
type BatchNodeData = BatchEntity["tasks"][number];
interface TaskManagerContextType {
	pollingInterval: number;
	setPollingInterval: Dispatch<SetStateAction<number>>;
	addBatch: (batch: BatchEntity) => void;
	nodeTaskStatus: Record<Node["id"], BatchNodeData[]>;
	isLoading: boolean;
	taskBatches: BatchEntity[];
	latestTasksFetchTime: number | null;
	isAnyTaskRunning: boolean;
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(
	undefined,
);

const TaskManagerProvider = ({
	children,
	canvasId,
}: PropsWithChildren<{ canvasId: Canvas["id"] }>) => {
	const dispatch = useAppDispatch();
	const pollingInterval = useAppSelector(selectPollingInterval);
	const batchIdsToPoll = useAppSelector(selectBatchIdsToPoll);
	const nodeTaskStatus = useAppSelector(selectNodeTaskStatus);
	const isLoading = useAppSelector(selectInitialLoading);
	const taskBatches = useAppSelector(selectAllBatches);
	const latestTasksFetchTime = useAppSelector(selectLatestTasksFetchTime);

	const prevFinishedBatchesRef = useRef<Set<string>>(new Set());
	const isFirstRunRef = useRef(true);

	useEffect(() => {
		if (isFirstRunRef.current) {
			const initialFinished = new Set(
				taskBatches.filter((b) => b.finishedAt != null).map((b) => b.id),
			);
			prevFinishedBatchesRef.current = initialFinished;
			isFirstRunRef.current = false;
			return;
		}

		const currentFinished = taskBatches.filter((b) => b.finishedAt != null);
		let shouldRefetch = false;

		for (const batch of currentFinished) {
			if (!prevFinishedBatchesRef.current.has(batch.id)) {
				shouldRefetch = true;
				prevFinishedBatchesRef.current.add(batch.id);
			}
		}

		if (shouldRefetch) {
			dispatch(assetsAPI.util.invalidateTags(["getUserAssets"]));
		}
	}, [taskBatches, dispatch]);

	const setPollingIntervalHandler = (value: SetStateAction<number>) => {
		if (typeof value === "function") {
			dispatch(setPollingInterval(value(pollingInterval)));
		} else {
			dispatch(setPollingInterval(value));
		}
	};

	const addBatch = (batchEntity: BatchEntity) => {
		dispatch(addBatchToPoll(batchEntity));
	};

	useEffect(() => {
		dispatch(getInitialBatches({ canvasId }));
	}, [dispatch, canvasId]);

	useEffect(() => {
		if (pollingInterval > 0) {
			const intervalId = setInterval(() => {
				const params: BatchDetailsRPCParams = {
					query: {
						batchId: batchIdsToPoll,
					},
				};
				dispatch(getBatchDetails(params));
			}, pollingInterval);

			return () => clearInterval(intervalId);
		}
	}, [pollingInterval, batchIdsToPoll, dispatch]);

	const isAnyTaskRunning = useMemo(() => {
		return Object.values(nodeTaskStatus).some((tasks) =>
			tasks.some(
				(task) => task.status === "EXECUTING" || task.status === "QUEUED",
			),
		);
	}, [nodeTaskStatus]);

	// Animate favicon when tasks are running
	useAnimatedFavicon(isAnyTaskRunning);

	const value: TaskManagerContextType = {
		pollingInterval,
		setPollingInterval: setPollingIntervalHandler,
		addBatch,
		nodeTaskStatus,
		isLoading,
		taskBatches,
		latestTasksFetchTime,
		isAnyTaskRunning,
	};

	return (
		<TaskManagerContext.Provider value={value}>
			{children}
		</TaskManagerContext.Provider>
	);
};

export function useTaskManagerCtx() {
	const ctx = useContext(TaskManagerContext);
	if (!ctx) {
		throw new Error("useTaskManagerCtx should used inside TaskManagerProvider");
	}
	return ctx;
}

export function useNodeTaskRunning(nodeId: NodeEntityType["id"]) {
	const { nodeTaskStatus } = useTaskManagerCtx();
	const isNodeRunning = useMemo(() => {
		const hasProp = Object.hasOwn(nodeTaskStatus, nodeId);
		if (hasProp) {
			const nodeTasks = nodeTaskStatus[nodeId];
			const isStillExecuting = nodeTasks.find(
				(status) => status.status === "EXECUTING" || status.status === "QUEUED",
			);
			return !!isStillExecuting;
		}
		return false;
	}, [nodeId, nodeTaskStatus]);

	return isNodeRunning;
}

export { TaskManagerContext, TaskManagerProvider };
