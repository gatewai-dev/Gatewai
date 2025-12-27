import { createContext, useContext, useMemo, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Canvas, Node } from '@gatewai/db';
import { useLazyGetBatchDetailsQuery } from '@/store/tasks';
import type { BatchDetailsRPC, BatchDetailsRPCParams } from '@/rpc/types';

type BatchNodeData = BatchDetailsRPC["batches"][number]["tasks"][number];
interface TaskManagerContextType {
  addBatchId: (batchId: string) => void
  nodeTaskStatus: Record<Node["id"], BatchNodeData[]>;
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);


const TaskManagerProvider = ({
  children,
}: PropsWithChildren<{canvasId: Canvas["id"]}>) => {
  const [pollingInterval, setPollingInterval] = useState(0);
  /**
   * The batches created by user's actions on the canvas
   */
  const [localBatches, setLocalBatches] = useState<BatchDetailsRPC["batches"]>([]);
  const [batchParams, setBatchParams] = useState<BatchDetailsRPCParams>({
    query: {
      batchId: [] as string[],
    }
  })

  const addBatchId = (batchId: string) => {
    setBatchParams({
      query: {
        batchId: Array.from(new Set([...batchParams.query.batchId, batchId])),
      }
    })
    setPollingInterval(2000);
  }

  const [trigger, batchList, lastPromiseInfo] = useLazyGetBatchDetailsQuery();


  const nodeTaskStatus = useMemo(() => {
    const status: Record<Node["id"], BatchNodeData[]> = {};
    batchList.data?.batches?.forEach((batchDetails) => {
      batchDetails?.tasks.forEach((task) => {
        if (task.nodeId) {
          if (status[task.nodeId]) {
            status[task.nodeId].push(task);
          } else {
            status[task.nodeId] = [task];
          }
        }
      })
    });

    return status;
  }, [batchList])

  const value: TaskManagerContextType = {
    pollingInterval,
    setPollingInterval,
    addBatchId,
    nodeTaskStatus
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

export { TaskManagerContext, TaskManagerProvider }