import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	CardContent,
	CardHeader,
	CardTitle,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@gatewai/ui-kit";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useProcessor } from "../../processor-ctx";

function DebugPanel() {
	const processor = useProcessor();
	const [logs, setLogs] = useState<string[]>([]);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onProcessed = ({ nodeId }: { nodeId: NodeEntityType["id"] }) => {
			setLogs((prev) => [...prev, `✅ ${nodeId} processed`]);
		};

		const onError = ({
			nodeId,
			error,
		}: {
			nodeId: NodeEntityType["id"];
			error: string;
		}) => {
			setLogs((prev) => [...prev, `❌ ${nodeId} error: ${error}`]);
		};

		processor.on("node:processed", onProcessed);
		processor.on("node:error", onError);

		return () => {
			processor.off("node:processed", onProcessed);
			processor.off("node:error", onError);
		};
	}, [processor]);

	const reversed = [...logs].reverse();

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" className="gap-2">
					{open ? "Hide Logs" : "Show Logs"}
					{open ? (
						<ChevronUp className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent
				side="top"
				align="end"
				className="w-80 p-0 shadow-xl"
				// This prevents the popover from closing when clicking outside
				onInteractOutside={(e) => e.preventDefault()}
			>
				<CardHeader className="flex flex-row justify-between items-center py-3 px-4 border-b">
					<CardTitle className="text-sm">Processing Log</CardTitle>
					<span className="text-[10px] text-muted-foreground uppercase font-bold">
						{logs.length} events
					</span>
				</CardHeader>

				<CardContent className="max-h-64 overflow-auto p-0 text-xs">
					{reversed.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground italic">
							No logs yet...
						</div>
					) : (
						reversed.map((log, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Bo other prop
								key={`${log}-${i}`}
								className="px-4 py-2 border-b border-muted last:border-0 hover:bg-muted/50 transition-colors"
							>
								{log}
							</div>
						))
					)}
				</CardContent>
			</PopoverContent>
		</Popover>
	);
}

export { DebugPanel };
