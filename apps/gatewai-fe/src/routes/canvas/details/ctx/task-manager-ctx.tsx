import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Canvas, Node, TaskBatch } from '@gatewai/db';
import { useGetActiveCanvasBatchesQuery } from '@/store/tasks';
import type { ActiveCanvasBatchListRPC, ActiveCanvasBatchListRPCParams } from '@/rpc/types';

interface TaskManagerContextType {
  taskBatchs: ActiveCanvasBatchListRPC | undefined;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;  
  pollingInterval: number;
  setPollingInterval: Dispatch<SetStateAction<number>>
  tasksFilters: ActiveCanvasBatchListRPCParams["query"];
  setTaskFilters: Dispatch<SetStateAction<{
    status?: string | undefined;
    fromDatetime?: string | undefined;
  }>>;
  initiatedBatches: TaskBatch[];
  setInitiatedBatches: Dispatch<SetStateAction<{
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    canvasId: string;
    finishedAt: Date | null;
  }[]>>;

  nodeTaskStatus: Record<Node["id"], ActiveCanvasBatchListRPC[number]["tasks"][number]>;
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);


const TaskManagerProvider = ({
  children,
  canvasId,
}: PropsWithChildren<{canvasId: Canvas["id"]}>) => {
  const [tasksFilters, setTaskFilters] = useState<ActiveCanvasBatchListRPCParams["query"]>({
    fromDatetime: undefined,
    taskStatus: ['EXECUTING', 'QUEUED', 'FAILED'],
  })

  const [pollingInterval, setPollingInterval] = useState(0);
  const [initiatedBatches, setInitiatedBatches] = useState<TaskBatch[]>([]);

  const {
    data: taskBatchs,
    isLoading,
    isFetching,
    isError,
  } = useGetActiveCanvasBatchesQuery({
    param: {
      canvasId
    },
    query: tasksFilters,
  }, {
    refetchOnFocus: true,
    pollingInterval,
  });


  useEffect(() => {
    if (taskBatchs?.length === 0) {
      setPollingInterval(0);
    }
  }, [taskBatchs?.length]);
  
  const nodeTaskStatus = useMemo(() => {
    const status: Record<Node["id"], ActiveCanvasBatchListRPC[number]["tasks"][number]> = {};
    taskBatchs?.forEach((batch) => {
      batch.tasks.forEach((task) => {
        if (task.nodeId) {
          status[task.nodeId] = task;
        }
      })
    })

    return status;
  }, [taskBatchs])

  const value: TaskManagerContextType = {
    taskBatchs,
    isError,
    isLoading,
    isFetching,
    pollingInterval,
    setPollingInterval,
    tasksFilters,
    setTaskFilters,
    initiatedBatches,
    setInitiatedBatches,
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