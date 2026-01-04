import { memo } from "react";
import { Separator } from "@/components/ui/separator";
import { CanvasName } from "./canvas-name";
import { CanvasTasksPanel } from "./tasks";

const TopPanel = memo(() => {
	return (
		<div className="border-0 bg-background gap-1 rounded-md shadow-md flex items-center w-full">
			<CanvasName />
			<Separator orientation="vertical" />
			<CanvasTasksPanel />
		</div>
	);
});

export { TopPanel };
