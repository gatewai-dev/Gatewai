import { formatDistanceToNow } from "date-fns";
import { AlertCircle } from "lucide-react";
import { memo } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useTaskManagerCtx } from "../ctx/task-manager-ctx";

const CanvasTasksPanel = memo(() => {
	const { isLoading, taskBatches, latestTasksFetchTime } = useTaskManagerCtx();

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider">
				<Spinner className="h-3 w-3" /> Syncing...
			</div>
		);
	}

	const runningTaskBatches =
		taskBatches?.filter((tb) => tb.finishedAt == null) ?? [];
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const failedTaskBatches =
		taskBatches?.filter(
			(tb) =>
				tb.finishedAt != null &&
				new Date(tb.finishedAt) > oneHourAgo &&
				tb.tasks.some((t) => t.status === "FAILED"),
		) ?? [];

	const sortedRunning = [...runningTaskBatches].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
	const sortedFailed = [...failedTaskBatches].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const runningCount = sortedRunning.length;
	const failedCount = sortedFailed.length;
	const totalCount = runningCount + failedCount;

	const indicatorColor =
		failedCount > 0
			? "bg-destructive"
			: runningCount > 0
				? "bg-amber-400"
				: "bg-emerald-500";

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					className="flex items-center gap-2 hover:bg-secondary/50 rounded-4xl transition-colors"
				>
					<span className={`h-1.5 w-1.5 rounded-full ${indicatorColor}`} />
					<span className="text-[11px] font-medium tabular-nums text-muted-foreground uppercase">
						{totalCount} Active
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-72 p-0 overflow-hidden border-border/50 shadow-xl"
				align="end"
			>
				<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
					<h4 className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
						Task Monitor
					</h4>
					{latestTasksFetchTime && (
						<span className="text-[10px] text-muted-foreground/60 tabular-nums">
							Refreshed{" "}
							{formatDistanceToNow(new Date(latestTasksFetchTime), {
								addSuffix: true,
							})}
						</span>
					)}
				</div>

				<div className="max-h-[400px] overflow-y-auto p-3 space-y-4">
					{totalCount === 0 ? (
						<div className="py-4 text-center">
							<p className="text-xs text-muted-foreground/60">
								No pending operations
							</p>
						</div>
					) : (
						<>
							{runningCount > 0 && (
								<section className="space-y-1.5">
									<h5 className="text-[10px] font-bold text-muted-foreground/50 uppercase px-1">
										Active Batches
									</h5>
									<div className="grid gap-1">
										{sortedRunning.map((tb) => {
											const exec = tb.tasks.filter(
												(t) => t.status === "EXECUTING",
											).length;
											const queued = tb.tasks.filter(
												(t) => t.status === "QUEUED",
											).length;
											return (
												<div
													key={tb.id}
													className="flex items-center gap-3 p-1.5 rounded-md border border-transparent bg-secondary/20"
												>
													<Spinner className="h-3 w-3 text-primary" />
													<div className="flex flex-col">
														<span className="text-xs font-medium tabular-nums">
															{exec} Running
														</span>
														<span className="text-[10px] text-muted-foreground">
															{queued} in queue
														</span>
													</div>
												</div>
											);
										})}
									</div>
								</section>
							)}

							{failedCount > 0 && (
								<section className="space-y-1.5">
									<h5 className="text-[10px] font-bold text-destructive/70 uppercase px-1">
										Incidents (Last 60m)
									</h5>
									<Accordion type="multiple" className="w-full space-y-1">
										{sortedFailed.map((tb) => {
											const failed = tb.tasks.filter(
												(t) => t.status === "FAILED",
											);
											return (
												<AccordionItem
													key={tb.id}
													value={tb.id}
													className="border rounded-md px-2 py-0 border-border/60"
												>
													<AccordionTrigger className="py-2 hover:no-underline">
														<div className="flex items-center gap-2 text-xs">
															<AlertCircle className="h-3 w-3 text-destructive" />
															<span className="font-medium">
																{failed.length} Nodes failed
															</span>
														</div>
													</AccordionTrigger>
													<AccordionContent className="pb-2 space-y-1">
														{failed.map((ft) => (
															<div
																key={ft.id}
																className="pl-2 border-l-2 border-destructive/30 py-1 space-y-0.5"
															>
																<p className="text-[10px] font-mono font-bold text-muted-foreground">
																	ID: {ft.nodeId ?? "anonymous"}
																</p>
																<p className="text-[11px] text-foreground/80 leading-snug">
																	{(ft?.error as unknown as { message: string })
																		?.message ?? "Execution aborted"}
																</p>
															</div>
														))}
													</AccordionContent>
												</AccordionItem>
											);
										})}
									</Accordion>
								</section>
							)}
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
});

export { CanvasTasksPanel };
