import { memo } from "react";
import { useTaskManagerCtx } from "../../ctx/task-manager-ctx";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const CanvasTasksPanel = memo(() => {
    const { tasks } = useTaskManagerCtx();
    if (!tasks) {
        return <>Loading...</>
    }
    const runningTasks = tasks.filter(
      (task) => task.status === "QUEUED" || task.status === "EXECUTING"
    );
    const count = runningTasks.length;
    const indicatorColor = count === 0 ? "bg-green-500" : "bg-amber-500";

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${indicatorColor} mr-2`} />
            {count} Running Task{count !== 1 ? "s" : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Running Tasks</h4>
            {runningTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks running.</p>
            ) : (
              <ul className="list-disc pl-4 space-y-1">
                {runningTasks.map((task) => (
                  <li key={task.id} className="text-sm">
                    {task.name} - {task.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
});

export { CanvasTasksPanel };