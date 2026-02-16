import {
	useCanvasCtx,
	useNodeRegistry,
	useReactFlow,
} from "@gatewai/react-canvas";
import type { NodeTemplateListItemRPC } from "@gatewai/react-store";
import { cn } from "@gatewai/ui-kit";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PiCube } from "react-icons/pi";

interface NodeItemProps {
	template: NodeTemplateListItemRPC;
	id_suffix?: string;
}

const DragOverlay = ({
	template,
	position,
}: {
	template: NodeTemplateListItemRPC;
	position: { x: number; y: number };
}) => {
	const { iconMap } = useNodeRegistry();
	const { mainIcon: MainIcon } = iconMap[template.type] ?? {
		mainIcon: PiCube,
	};

	return createPortal(
		<div
			className="fixed z-9999 pointer-events-none"
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -50%)", // Center on cursor
			}}
		>
			<div
				className={cn(
					"flex items-center gap-3 p-3 pl-2 pr-4",
					"bg-background/80 backdrop-blur-2xl border border-primary/20",
					"rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
					"w-48 scale-105 ring-1 ring-primary/30",
				)}
			>
				<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<MainIcon className="h-5 w-5" />
				</div>
				<div className="flex flex-col">
					<span className="text-sm font-semibold text-foreground">
						{template.displayName}
					</span>
					<span className="text-[10px] text-muted-foreground font-medium">
						Release to drop
					</span>
				</div>
			</div>
		</div>,
		document.body,
	);
};

export const NodeItem = memo(({ template, id_suffix }: NodeItemProps) => {
	const { createNewNode } = useCanvasCtx();
	const rfInstance = useReactFlow(); // Ensure we have access to the flow instance

	const [isDragging, setIsDragging] = useState(false);
	const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

	const itemRef = useRef<HTMLDivElement>(null);

	const { iconMap } = useNodeRegistry();
	const { mainIcon: MainIcon } = iconMap[template.type] ?? {
		mainIcon: PiCube,
	};

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			setCursorPos({ x: e.clientX, y: e.clientY });
		};

		const handleMouseUp = (e: MouseEvent) => {
			setIsDragging(false);

			// 1. Check if dropped inside the React Flow Canvas
			const flowContainer = document.querySelector(".react-flow-container");
			if (!flowContainer) return;

			const flowRect = flowContainer.getBoundingClientRect();
			const isInside =
				e.clientX >= flowRect.left &&
				e.clientX <= flowRect.right &&
				e.clientY >= flowRect.top &&
				e.clientY <= flowRect.bottom;

			if (isInside && rfInstance) {
				// 2. Project screen coordinates to Flow coordinates
				const position = rfInstance.screenToFlowPosition({
					x: e.clientX,
					y: e.clientY,
				});

				// 3. Create the node
				createNewNode(template, position);
			}
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, template, createNewNode, rfInstance]);

	const handleMouseDown = (e: React.MouseEvent) => {
		// Prevent text selection
		e.preventDefault();
		setCursorPos({ x: e.clientX, y: e.clientY });
		setIsDragging(true);
	};

	return (
		<>
			{/* The Overlay (Only visible when dragging) */}
			{isDragging && <DragOverlay template={template} position={cursorPos} />}

			{/* The Static Item in the List */}
			<motion.div
				ref={itemRef}
				layoutId={`node-item-${template.id}-${id_suffix}`}
				onMouseDown={handleMouseDown}
				className={cn(
					"group relative flex w-full cursor-grab active:cursor-grabbing select-none items-center gap-3",
					"rounded-xl border border-transparent p-2 transition-all duration-200",
					"hover:bg-muted/50 hover:border-border/40",
					isDragging ? "opacity-30 grayscale" : "opacity-100",
				)}
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
			>
				{/* Icon Container */}
				<div
					className={cn(
						"flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
						"bg-muted/80 text-muted-foreground transition-colors duration-300",
						"group-hover:bg-primary/10 group-hover:text-primary shadow-sm",
					)}
				>
					<MainIcon className="h-5 w-5" />
				</div>

				{/* Text Content */}
				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="flex items-center justify-between">
						<span className="truncate text-[13px] font-medium leading-tight text-foreground/90">
							{template.displayName}
						</span>
					</div>
					<span className="text-[11px] text-muted-foreground/80">
						{template.description || "Drag to add to canvas"}
					</span>
				</div>

				{/* Drag Handle Indicator (Subtle) */}
				<GripVertical className="h-4 w-4 text-border opacity-0 transition-opacity group-hover:opacity-100" />
			</motion.div>
		</>
	);
});
