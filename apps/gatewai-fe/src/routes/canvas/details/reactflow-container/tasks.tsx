import { AlertCircle } from "lucide-react";
import { memo } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useTaskManagerCtx } from "../ctx/task-manager-ctx";

const CanvasTasksPanel = memo(() => {
	const { isLoading, taskBatches } = useTaskManagerCtx();
	if (isLoading) {
		return (
			<div className="flex items-center justify-center text-xs">
				Loading <Spinner />
			</div>
		);
	}
	const runningTaskBatches =
		taskBatches?.filter((taskBatch) => taskBatch.finishedAt == null) ?? [];
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const failedTaskBatches =
		taskBatches?.filter(
			(taskBatch) =>
				taskBatch.finishedAt != null &&
				new Date(taskBatch.finishedAt) > oneHourAgo &&
				taskBatch.tasks.some((t) => t.status === "FAILED"),
		) ?? [];

	const sortedRunningTaskBatches = [...runningTaskBatches].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
	const sortedFailedTaskBatches = [...failedTaskBatches].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const runningCount = sortedRunningTaskBatches.length;
	const failedCount = sortedFailedTaskBatches.length;
	const totalCount = runningCount + failedCount;

	let indicatorColor: string;
	if (failedCount > 0) {
		indicatorColor = "bg-red-500";
	} else if (runningCount > 0) {
		indicatorColor = "bg-amber-500";
	} else {
		indicatorColor = "bg-green-500";
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					className="flex items-center rounded-full text-xs"
				>
					<div className={`w-2 h-2 rounded-full ${indicatorColor}`} />
					{totalCount} Task{totalCount !== 1 ? "s" : ""}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80">
				<div className="space-y-4">
					<h4 className="font-medium leading-none">Tasks</h4>
					{totalCount === 0 ? (
						<p className="text-sm text-muted-foreground">No active tasks.</p>
					) : (
						<>
							{runningCount > 0 && (
								<div className="space-y-2">
									<h5 className="text-sm font-medium">Running Tasks</h5>
									<div className="flex w-full max-w-xs flex-col gap-4 [--radius:1rem]">
										{sortedRunningTaskBatches.map((taskBatch) => {
											const executingCount = taskBatch.tasks.filter(
												(t) => t.status === "EXECUTING",
											).length;
											const queuedCount = taskBatch.tasks.filter(
												(t) => t.status === "QUEUED",
											).length;
											return (
												<Item key={taskBatch.id} variant="muted">
													<ItemMedia>
														<Spinner />
													</ItemMedia>
													<ItemContent>
														<ItemTitle className="line-clamp-1">
															{executingCount} Executing, {queuedCount} Queued
														</ItemTitle>
													</ItemContent>
												</Item>
											);
										})}
									</div>
								</div>
							)}
							{failedCount > 0 && (
								<div className="space-y-2">
									<h5 className="text-sm font-medium">
										Failed Tasks (Last Hour)
									</h5>
									<Accordion type="multiple" className="w-full">
										{sortedFailedTaskBatches.map((taskBatch) => {
											const failedTasks = taskBatch.tasks.filter(
												(t) => t.status === "FAILED",
											);
											return (
												<AccordionItem key={taskBatch.id} value={taskBatch.id}>
													<AccordionTrigger>
														<div className="flex items-center">
															<AlertCircle className="h-4 w-4 text-red-500 mr-2" />
															{failedTasks.length} / {taskBatch.tasks.length}{" "}
															Failed Nodes
														</div>
													</AccordionTrigger>
													<AccordionContent>
														{failedTasks.map((ft) => (
															<div
																key={ft.id}
																className="mb-2 p-2 bg-red-50 rounded-md"
															>
																<p className="text-sm font-medium">
																	Node: {ft.nodeId ?? "Unknown"}
																</p>
																<p className="text-sm text-red-600">
																	{ft.error?.message ?? "Unknown error"}
																</p>
															</div>
														))}
													</AccordionContent>
												</AccordionItem>
											);
										})}
									</Accordion>
								</div>
							)}
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
});

export { CanvasTasksPanel };
