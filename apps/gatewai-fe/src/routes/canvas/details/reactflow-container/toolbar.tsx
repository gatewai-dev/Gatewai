import { useReactFlow, useViewport } from "@xyflow/react";
import { ChevronDown, Hand, MousePointer } from "lucide-react";
import { memo, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { Separator } from "@/components/ui/separator";
import { ModeContext } from ".";

const Toolbar = memo(() => {
	const { zoom } = useViewport();
	const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
	const zoomPercentage = `${Math.round(zoom * 100)}%`;
	const modeCtx = useContext(ModeContext);

	return (
		<Menubar className="border-0 bg-background py-1 rounded-md shadow-md">
			<Button
				title="Select"
				variant={modeCtx?.mode === "pan" ? "ghost" : "outline"}
				size="sm"
				onClick={() => modeCtx?.setMode("select")}
			>
				<MousePointer className="w-4" />
			</Button>
			<Button
				title="Pan"
				variant={modeCtx?.mode === "select" ? "ghost" : "outline"}
				size="sm"
				onClick={() => modeCtx?.setMode("pan")}
			>
				<Hand className="w-4" />
			</Button>
			<Separator orientation="vertical" />
			<MenubarMenu>
				<MenubarTrigger className="px-3 py-1 cursor-pointer text-xs">
					{zoomPercentage} <ChevronDown className="w-5" />
				</MenubarTrigger>
				<MenubarContent align="end">
					<MenubarItem onClick={() => zoomIn()}>
						Zoom in{" "}
						<span className="ml-auto text-muted-foreground">Ctrl +</span>
					</MenubarItem>
					<MenubarItem onClick={() => zoomOut()}>
						Zoom out{" "}
						<span className="ml-auto text-muted-foreground">Ctrl -</span>
					</MenubarItem>
					<MenubarItem onClick={() => zoomTo(1)}>
						Zoom to 100%{" "}
						<span className="ml-auto text-muted-foreground">Ctrl 0</span>
					</MenubarItem>
					<MenubarItem onClick={() => fitView()}>
						Zoom to fit{" "}
						<span className="ml-auto text-muted-foreground">Ctrl 1</span>
					</MenubarItem>
				</MenubarContent>
			</MenubarMenu>
		</Menubar>
	);
})

export { Toolbar };
