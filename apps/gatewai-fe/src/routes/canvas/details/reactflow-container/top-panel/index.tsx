import { CoinsIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CanvasName } from "./canvas-name";
import { CanvasTasksPanel } from "./tasks";

const TopPanel = memo(() => {
	return (
		<div className="border-0 bg-background gap-1 rounded-md shadow-md flex items-center">
			<CanvasName />
			<Separator orientation="vertical" />
			<CanvasTasksPanel />
			<Separator orientation="vertical" />
			<Button variant="link" className="flex gap-1 items-center text-xs">
				1000 <CoinsIcon />
			</Button>
		</div>
	);
});

export { TopPanel };
