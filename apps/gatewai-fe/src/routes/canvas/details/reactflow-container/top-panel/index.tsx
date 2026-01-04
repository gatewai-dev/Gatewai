import { Panel } from "@xyflow/react";
import { memo } from "react";
import { Separator } from "@/components/ui/separator";
import { CanvasName } from "./canvas-name";
import { CanvasTasksPanel } from "./tasks";

const TopPanel = memo(() => {
	return (
		<Panel
			position="top-center"
			className=" bg-background left-0 top-0 m-0!  flex flex-col"
		>
			<div className="border-0 bg-background gap-1 rounded-md shadow-md flex items-center">
				<CanvasName />
				<Separator orientation="vertical" />
				<CanvasTasksPanel />
			</div>
		</Panel>
	);
});

export { TopPanel };
