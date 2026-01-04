import {
	BaseEdge,
	type ConnectionLineComponentProps,
	type EdgeProps,
	getBezierPath,
	Handle,
	type Node,
	Position,
} from "@xyflow/react";
import { type JSX, memo, type ReactNode, useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { dataTypeColors } from "@/config";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
} from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { NODE_ICON_MAP } from "../../node-templates/node-palette/icon-map";
import { useNodeResult, useNodeValidation } from "../processor/processor-ctx";
import { NodeMenu } from "./node-menu";

const DEFAULT_COLOR = "#9ca3af";

const getTypeColor = (type?: string) =>
	dataTypeColors[type || ""]?.hex || DEFAULT_COLOR;

/**
 * Optimizes handle styles by using CSS variables where possible
 * and reducing object creation.
 */
export const getHandleStyle = (
	types: string[],
	isConnected: boolean,
	connectedType?: string,
	isValid: boolean = true,
): React.CSSProperties => {
	if (!isValid) {
		return {
			backgroundColor: "var(--destructive)",
			border: "2px solid var(--background)",
			boxShadow: "0 0 0 3px var(--destructive), 0 0 10px var(--destructive/60)",
			width: "12px",
			height: "12px",
			backfaceVisibility: "hidden",
			transform: "translateZ(0)",
		};
	}

	if (isConnected || connectedType) {
		const color = getTypeColor(connectedType || types[0]);

		return {
			width: "12px",
			height: "12px",
			backgroundColor: color,
			border: "2px solid var(--background)",
			boxShadow: `
        0 0 0 2px ${color}80,
        0 0 12px ${color}60
      `,
			transition: "all 0.18s ease",
			backfaceVisibility: "hidden",
			transform: "translateZ(0)",
		};
	}

	// Unconnected handles
	if (types.length > 1) {
		const segmentSize = 100 / types.length;
		const gradientStops = types
			.map((type, index) => {
				const color = getTypeColor(type);
				const start = index * segmentSize;
				const end = (index + 1) * segmentSize;
				return `${color} ${start}% ${end}%`;
			})
			.join(", ");

		return {
			width: "12px",
			height: "12px",
			backgroundColor: "transparent",
			border: "2px solid transparent",
			borderImage: `conic-gradient(${gradientStops}) 1`,
			borderImageSlice: 1,
			boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
			backfaceVisibility: "hidden",
			transform: "translateZ(0)",
		};
	}

	const color = getTypeColor(types[0]);
	return {
		width: "12px",
		height: "12px",
		backgroundColor: "transparent",
		border: `2px solid ${color}`,
		boxShadow: `0 0 0 1px ${color}30`,
		backfaceVisibility: "hidden",
		transform: "translateZ(0)",
	};
};

const NodeHandle = memo(
	({
		handle,
		index,
		type,
		isValid,
		hasValue,
		connectedType,
		nodeSelected,
	}: {
		handle: HandleEntityType;
		index: number;
		type: "source" | "target";
		isValid: boolean;
		hasValue: boolean;
		connectedType?: string;
		nodeSelected?: boolean;
	}) => {
		const isTarget = type === "target";

		const handleStyle = useMemo(
			() =>
				getHandleStyle(
					handle.dataTypes,
					hasValue || !isTarget,
					connectedType,
					isValid,
				),
			[handle.dataTypes, hasValue, isTarget, connectedType, isValid],
		);

		const activeColor = useMemo(
			() =>
				connectedType
					? getTypeColor(connectedType)
					: getTypeColor(handle.dataTypes[0]),
			[connectedType, handle.dataTypes],
		);

		const topPosition = (index + 1) * 36 + 24;

		const handleComponent = (
			<Handle
				id={handle.id}
				type={type}
				position={isTarget ? Position.Left : Position.Right}
				style={handleStyle}
				className={cn(
					"transition-shadow duration-200 border-none",
					!isValid &&
						"animate-pulse ring-2 ring-destructive ring-offset-2 ring-offset-background",
				)}
			/>
		);

		return (
			<div
				className={cn(
					"absolute z-50 flex items-center group/handle will-change-transform",
					isTarget ? "-left-1.5" : "-right-1.5",
				)}
				style={{ top: `${topPosition}px` }}
			>
				{/* External Label */}
				<div
					className={cn(
						"absolute -top-8 whitespace-nowrap py-0 rounded-lg transition-all duration-200 ease-out pointer-events-none opacity-0 group-hover:opacity-100",
						isTarget
							? "right-2  flex-row-reverse text-right origin-right"
							: "left-2 text-left origin-left",
						nodeSelected ? "opacity-100 scale-110 shadow-sm" : "scale-95",
					)}
				>
					<span
						className="text-[8px] font-bold uppercase tracking-widest leading-none"
						style={{ color: activeColor }}
					>
						{handle.label || connectedType || handle.dataTypes[0]}
						{handle.required && <span className="ml-0.5">*</span>}
					</span>
				</div>

				{!isValid ? (
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>{handleComponent}</TooltipTrigger>
							<TooltipContent
								arrowPadding={120}
								side={isTarget ? "left" : "right"}
								className=" border-none font-bold text-[10px] uppercase"
							>
								Invalid data type
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					handleComponent
				)}
			</div>
		);
	},
);

const BaseNode = memo(
	(props: {
		selected: boolean;
		id: string;
		dragging: boolean;
		children?: ReactNode;
		className?: string;
	}) => {
		const { selected, id, dragging } = props;

		const selectHandles = useMemo(() => makeSelectHandlesByNodeId(id), [id]);
		const handles = useAppSelector(selectHandles);
		const selectNode = useMemo(() => makeSelectNodeById(id), [id]);
		const node = useAppSelector(selectNode);
		const { inputs } = useNodeResult(id);
		const validation = useNodeValidation(id);
		const hasTypeMismatch = (handleId: HandleEntityType["id"]) =>
			validation?.[handleId] === "type_mismatch";

		const { inputHandles, outputHandles } = useMemo(() => {
			const sorted = [...handles].sort((a, b) => a.order - b.order);
			return {
				inputHandles: sorted.filter((h) => h.type === "Input"),
				outputHandles: sorted.filter((h) => h.type === "Output"),
			};
		}, [handles]);

		const Icon = useMemo(
			() =>
				node &&
				(NODE_ICON_MAP[node?.type]?.(node) || NODE_ICON_MAP.File?.(node)),
			[node],
		);

		return (
			<div
				className={cn(
					"relative flex flex-col w-full h-full",
					!dragging && "transition-shadow duration-300",
					dragging ? "bg-card/55 shadow-md" : "bg-card/95 border-border/40",
					"border rounded-3xl",
					"group hover:border-border/80",
					selected &&
						"ring-2 ring-primary/40 ring-offset-4 ring-offset-background border-primary/50 ",
					// 3. Force GPU layer
					"transform-gpu",
					props.className,
				)}
				// Inline style for will-change to help the browser layerize the node
				style={{ willChange: dragging ? "transform" : "auto" }}
			>
				{/* Inputs */}
				<div className="absolute inset-y-0 left-0 w-0">
					{inputHandles.map((handle, i) => (
						<NodeHandle
							key={handle.id}
							handle={handle}
							index={i}
							type="target"
							isValid={!hasTypeMismatch(handle?.id)}
							hasValue={inputs[handle.id]?.outputItem?.data != null}
							connectedType={inputs[handle.id]?.outputItem?.type}
							nodeSelected={selected}
						/>
					))}
				</div>

				{/* Content Container */}
				<div className="flex flex-col h-full overflow-hidden p-1.5">
					<div className="flex items-center justify-between px-3 py-2.5 mb-1 drag-handle cursor-grab active:cursor-grabbing border-b border-border/5">
						<div className="flex items-center gap-3 min-w-0">
							{Icon && (
								<div className="text-foreground/80 bg-muted/40 p-2 rounded-xl shadow-inner">
									<Icon className="w-4 h-4" />
								</div>
							)}
							<div className="flex flex-col min-w-0">
								<span className="text-[13px] font-bold tracking-tight text-foreground/90 truncate">
									{node?.name}
								</span>
								<span className="text-[9px] text-muted-foreground font-mono opacity-50 uppercase tracking-tighter">
									ID: {node?.id.slice(0, 6)}
								</span>
							</div>
						</div>
						<NodeMenu id={props.id} />
					</div>

					<div className="flex-1 px-1 nodrag nopan cursor-auto">
						{props.children}
					</div>
				</div>

				{/* Outputs */}
				<div className="absolute inset-y-0 right-0 w-0">
					{outputHandles.map((handle, i) => (
						<NodeHandle
							key={handle.id}
							handle={handle}
							index={i}
							type="source"
							isValid={true}
							hasValue={true}
							connectedType={handle.dataTypes[0]}
							nodeSelected={selected}
						/>
					))}
				</div>
			</div>
		);
	},
);

BaseNode.displayName = "BaseNode";

const CustomConnectionLine = memo(
	({
		fromX,
		fromY,
		toX,
		toY,
		fromPosition,
		toPosition,
		connectionStatus,
	}: ConnectionLineComponentProps<Node>): JSX.Element => {
		const [edgePath] = getBezierPath({
			sourceX: fromX,
			sourceY: fromY,
			sourcePosition: fromPosition,
			targetX: toX,
			targetY: toY,
			targetPosition: toPosition,
		});

		const strokeColor =
			connectionStatus === "valid"
				? "var(--primary)"
				: connectionStatus === "invalid"
					? "var(--destructive)"
					: "var(--muted-foreground)";

		return (
			<g className="pointer-events-none">
				<path
					fill="none"
					stroke={strokeColor}
					strokeWidth={2}
					d={edgePath}
					strokeDasharray="4 6"
					className="animate-[dash_1.5s_linear_infinite] opacity-50"
				/>
				<circle
					cx={toX}
					cy={toY}
					r={5}
					fill={strokeColor}
					className="animate-pulse"
				/>
			</g>
		);
	},
);

interface CustomEdgeProps extends EdgeProps {
	sourceX: number;
	sourceY: number;
	targetX: number;
	targetY: number;
	sourcePosition: Position;
	targetPosition: Position;
	style?: React.CSSProperties;
	data?: { type?: string };
}

const CustomEdge = memo(
	({
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		style = {},
		markerEnd,
		selected,
		data,
	}: CustomEdgeProps): JSX.Element => {
		const [edgePath] = getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
		});

		const color = useMemo(
			() =>
				selected
					? "var(--primary)"
					: getTypeColor(data?.type) || "var(--border)",
			[selected, data?.type],
		);

		return (
			<>
				<BaseEdge
					path={edgePath}
					style={{ strokeWidth: 10, stroke: "transparent" }}
				/>
				<BaseEdge
					id={id}
					path={edgePath}
					markerEnd={markerEnd}
					style={{
						...style,
						strokeWidth: selected ? 3.5 : 2.5,
						stroke: color,
						opacity: selected ? 1 : 0.45,
						transition: "opacity 0.2s ease, stroke-width 0.2s ease",
					}}
				/>
			</>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };
