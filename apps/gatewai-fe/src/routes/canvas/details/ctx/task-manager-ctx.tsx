import { createContext, useContext, useEffect, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Canvas, Node } from '@gatewai/db';
import { useDispatch, useSelector } from 'react-redux';
import type { BatchDetailsRPC, BatchDetailsRPCParams } from '@/rpc/types';
import { addBatchToPoll, getBatchDetails, getInitialBatches, selectBatchIdsToPoll, selectInitialLoading, selectNodeTaskStatus, selectPollingInterval, setPollingInterval } from '@/store/tasks';
import { batchSelectors } from '@/store/tasks';

type BatchEntity = BatchDetailsRPC["batches"][number];
type BatchNodeData = BatchEntity["tasks"][number];
interface TaskManagerContextType {
  pollingInterval: number;
  setPollingInterval: Dispatch<SetStateAction<number>>;
  addBatch: (batch: BatchEntity) => void;
  nodeTaskStatus: Record<Node["id"], BatchNodeData[]>;
  isLoading: boolean;
  taskBatches: BatchEntity[];
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);

const TaskManagerProvider = ({
  children,
  canvasId,
}: PropsWithChildren<{ canvasId: Canvas["id"] }>) => {
  const dispatch = useDispatch();
  const pollingInterval = useSelector(selectPollingInterval);
  const batchIdsToPoll = useSelector(selectBatchIdsToPoll);
  const nodeTaskStatus = useSelector(selectNodeTaskStatus);
  const isLoading = useSelector(selectInitialLoading);
  const taskBatches = useSelector(batchSelectors.selectAll);

  const setPollingIntervalHandler = (value: SetStateAction<number>) => {
    if (typeof value === 'function') {
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

  const value: TaskManagerContextType = {
    pollingInterval,
    setPollingInterval: setPollingIntervalHandler,
    addBatch,
    nodeTaskStatus,
    isLoading,
    taskBatches,
  };

  return <TaskManagerContext.Provider value={value}>{children}</TaskManagerContext.Provider>;
};

export function useTaskManagerCtx() {
  const ctx = useContext(TaskManagerContext);
  if (!ctx) {
    throw new Error('useTaskManagerCtx should used inside TaskManagerProvider');
  }
  return ctx;
}

export { TaskManagerContext, TaskManagerProvider };