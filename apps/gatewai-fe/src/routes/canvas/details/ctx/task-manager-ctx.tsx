import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type { Canvas } from '@gatewai/types';
import { useGetCanvasTasksQuery } from '@/store/tasks';
import type { CanvasTaskListRPCParams, CanvasTaskListRPC } from '@/rpc/types';

interface TaskManagerContextType {
  tasks: CanvasTaskListRPC | undefined;
  isError: boolean;
  isLoading: boolean;
  pollingInterval: number;
  refetch: () => void;
  setPollingInterval: Dispatch<SetStateAction<number>>
  tasksFilters: CanvasTaskListRPCParams["query"];
  setTaskFilters: Dispatch<SetStateAction<{
    status?: string | undefined;
    fromDatetime?: string | undefined;
  }>>;
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);


const TaskManagerProvider = ({
  children,
  canvasId,
}: PropsWithChildren<{canvasId: Canvas["id"]}>) => {
  const [tasksFilters, setTaskFilters] = useState<CanvasTaskListRPCParams["query"]>({
    fromDatetime: undefined,
    taskStatus: ['EXECUTING', 'QUEUED', 'FAILED'],
  })

  const [pollingInterval, setPollingInterval] = useState(0);

  const {
    data: tasks,
    refetch,
    isLoading,
    isError,
  } = useGetCanvasTasksQuery({
    param: {
      canvasId
    },
    query: tasksFilters,
  }, {
    refetchOnFocus: true,
    pollingInterval,
  });

  const value: TaskManagerContextType = {
    tasks,
    isError,
    isLoading,
    refetch,
    pollingInterval,
    setPollingInterval,
    tasksFilters,
    setTaskFilters,
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