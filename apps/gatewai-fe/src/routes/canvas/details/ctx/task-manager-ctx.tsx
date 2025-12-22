import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import type {Canvas, Task } from '@gatewai/types';

interface TaskManagerContextType {
  tasks: Task[] | undefined;
  isError: boolean;
  isLoading: boolean;
  refetchInterval: number;
  refetch: () => void;
  setRefetchInterval: Dispatch<SetStateAction<number>>
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);

const fetchTasks = async (canvasId: Canvas["id"]): Promise<Task[]> => {
  const response = await fetch(`/api/v1/tasks?canvasId=${canvasId}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const TaskManagerProvider = ({
  children,
  canvasId,
}: PropsWithChildren<{canvasId: Canvas["id"]}>) => {

  const [refetchInterval, setRefetchInterval] = useState(0);

  const {
    data: tasks,
    refetch,
    isLoading,
    isError,
  } = useQuery<Task[]>({
    queryKey: ['canvasList'],
    refetchInterval,
    queryFn: () => fetchTasks(canvasId),
  });

  const value: TaskManagerContextType = {
    tasks,
    isError,
    isLoading,
    refetch,
    refetchInterval,
    setRefetchInterval,
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