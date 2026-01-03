import { useDraggable } from "@neodrag/react";
import type { XYPosition } from "@xyflow/react";
import { useRef, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeTemplateListItemRPC } from "@/rpc/types";
import { NODE_ICON_MAP } from "./icon-map";

export function NodeItem({ template }: { template: NodeTemplateListItemRPC }) {
	const { rfInstance, createNewNode } = useCanvasCtx();
	const draggableRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<XYPosition>({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);

	useDraggable(draggableRef, {
		position: position,
		onDragStart: () => setIsDragging(true),
		onDrag: ({ offsetX, offsetY }) => {
			setPosition({ x: offsetX, y: offsetY });
		},
		onDragEnd: ({ event }) => {
			setIsDragging(false);
			setPosition({ x: 0, y: 0 });

			const flow = document.querySelector(".react-flow-container");
			const flowRect = flow?.getBoundingClientRect();
			const screenPosition = { x: event.clientX, y: event.clientY };

			const isInFlow =
				flowRect &&
				screenPosition.x >= flowRect.left &&
				screenPosition.x <= flowRect.right &&
				screenPosition.y >= flowRect.top &&
				screenPosition.y <= flowRect.bottom;

			if (isInFlow) {
				const position =
					rfInstance.current?.screenToFlowPosition(screenPosition);
				createNewNode(template, position || { x: 0, y: 0 });
			}
		},
	});

	const Icon = NODE_ICON_MAP[template.type]?.() || NODE_ICON_MAP.File;

	return (
		<TooltipProvider delayDuration={700}>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						ref={draggableRef}
						className={cn(
							// Base Layout - Matching BaseNode's "Card" aesthetic
							"group relative flex flex-col items-center justify-center",
							"aspect-square w-full p-3 transition-all duration-300 ease-out",
							"bg-card/75 backdrop-blur-2xl border border-border/40 rounded-3xl shadow-sm",
							"cursor-grab active:cursor-grabbing select-none",
							"hover:border-border/80 hover:shadow-md hover:-translate-y-0.5",

							// Dragging State
							isDragging && [
								"z-100 scale-110 shadow-2xl opacity-90",
								"ring-2 ring-primary/40 ring-offset-4 ring-offset-background border-primary/50",
								"cursor-grabbing",
							],
						)}
					>
						<div
							className={cn(
								"mb-3 p-2.5 rounded-xl transition-all duration-300",
								"bg-muted/40 text-foreground/80 shadow-inner",
								"group-hover:scale-110 group-hover:bg-muted/60",
								isDragging && "shadow-none scale-100",
							)}
						>
							<Icon className="w-5 h-5" />
						</div>

						<div className="flex flex-col items-center gap-0.5 px-1 w-full">
							<span className="text-[12px] font-bold tracking-tight text-foreground/90 text-center line-clamp-1">
								{template.displayName}
							</span>
						</div>

						<div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
					</div>
				</TooltipTrigger>

				{!isDragging && template.description && (
					<TooltipContent
						side="right"
						sideOffset={15}
						className="max-w-[220px] bg-popover/90 backdrop-blur-md border-border/50 p-3 rounded-xl shadow-xl"
					>
						<p className="text-[11px] leading-relaxed font-medium text-foreground/80">
							{template.description}
						</p>
					</TooltipContent>
				)}
			</Tooltip>
		</TooltipProvider>
	);
}
