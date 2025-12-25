import { memo } from "react";
import { useTaskManagerCtx } from "../../ctx/task-manager-ctx";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner"
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const CanvasTasksPanel = memo(() => {
    const { isLoading, taskBatchs } = useTaskManagerCtx();
    if (isLoading) {
        return <div className="flex items-center justify-center text-xs">Loading <Spinner /></div>
    }
    const runningTaskBatchs = taskBatchs?.filter(
      (taskBatch) => taskBatch.finishedAt == null);

    const count = runningTaskBatchs?.length ?? 0;
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
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks running.</p>
            ) : (
              <div className="flex w-full max-w-xs flex-col gap-4 [--radius:1rem]">
                {runningTaskBatchs?.map((taskBatch) => (
                <Item key={taskBatch.id} variant="muted">
                  <ItemMedia>
                    <Spinner />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="line-clamp-1">{taskBatch.tasks.length} Nodes</ItemTitle>
                  </ItemContent>
                </Item>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
});

export { CanvasTasksPanel };