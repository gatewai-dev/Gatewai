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
import { NODE_ICON_MAP } from "../node-templates/node-palette/icon-map";
import { useNodeResult, useNodeValidation } from "../processor/processor-ctx";
import { NodeMenu } from "./node-menu";

const DEFAULT_COLOR = "#9ca3af";

const getTypeColor = (type?: string) =>
	dataTypeColors[type || ""]?.hex || DEFAULT_COLOR;

/**
 * Generates styles for the handle.
 * REMOVED: translateZ and backface-visibility to fix zoom blurriness.
 * CHANGED: Logic to support rectangular 'pill' shapes.
 */
export const getHandleStyle = (
	types: string[],
	isConnected: boolean,
	connectedType?: string,
	isValid: boolean = true,
): React.CSSProperties => {
	const baseDimensions = {
		width: "10px",
		height: "18px", // Rectangular height
		borderRadius: "2px", // Slight rounding for polish
	};

	if (!isValid) {
		return {
			...baseDimensions,
			backgroundColor: "var(--destructive)",
			border: "1px solid var(--background)",
			boxShadow: "0 0 0 2px var(--destructive), 0 0 8px var(--destructive/50)",
		};
	}

	if (isConnected || connectedType) {
		const color = getTypeColor(connectedType || types[0]);
		return {
			...baseDimensions,
			backgroundColor: color,
			border: "1px solid var(--background)",
			// Softer glow for connected state
			boxShadow: `0 0 0 1px ${color}80`,
			transition: "background-color 0.15s ease, box-shadow 0.15s ease",
		};
	}

	// Unconnected handles with multiple types
	if (types.length > 1) {
		const segmentSize = 100 / types.length;
		// Linear gradient looks cleaner on rectangles than conic
		const gradientStops = types
			.map((type, index) => {
				const color = getTypeColor(type);
				const start = index * segmentSize;
				const end = (index + 1) * segmentSize;
				return `${color} ${start}% ${end}%`;
			})
			.join(", ");

		return {
			...baseDimensions,
			background: `linear-gradient(to bottom, ${gradientStops})`,
			border: "1px solid var(--border)",
			boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
		};
	}

	// Single type unconnected
	const color = getTypeColor(types[0]);
	return {
		...baseDimensions,
		backgroundColor: "var(--card)", // Hollow look for unconnected
		border: `2px solid ${color}`,
		boxShadow: "none",
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

		// Adjust vertical spacing
		const topPosition = (index + 1) * 32 + 20;

		const handleComponent = (
			<Handle
				id={handle.id}
				type={type}
				position={isTarget ? Position.Left : Position.Right}
				style={handleStyle}
				className={cn(
					!isValid && "animate-pulse",
					"hover:scale-110 transition-transform duration-75",
				)}
			/>
		);

		return (
			<div
				className={cn(
					"absolute z-50 flex items-center group/handle",
					// Adjusted offsets for rectangular shape overlap
					isTarget ? "-left-[5px]" : "-right-[5px]",
				)}
				style={{ top: `${topPosition}px` }}
			>
				<div
					className={cn(
						"absolute -top-4 pointer-events-none opacity-0 transition-opacity duration-200 w-auto whitespace-nowrap",
						// Logic: Show if handle is hovered OR if the whole node is hovered OR if node is selected
						"group-hover/handle:opacity-100 group-hover/node:opacity-100",
						{ "opacity-100": nodeSelected },
						isTarget
							? "right-3 text-right origin-right"
							: "left-3 text-left origin-left",
					)}
				>
					<span
						className="text-[9px] font-bold uppercase tracking-wider shadow-sm leading-none"
						style={{
							color: activeColor,
							textShadow: "0 1px 2px rgba(0,0,0,0.1)",
						}}
					>
						{handle.label || connectedType || handle.dataTypes[0]}
						{handle.required && (
							<span className="text-destructive ml-0.5">*</span>
						)}
					</span>
				</div>

				{!isValid ? (
					<Tooltip>
						<TooltipTrigger asChild>{handleComponent}</TooltipTrigger>
						<TooltipContent
							side={"bottom"}
							className="bg-destructive text-destructive-foreground border-none text-[10px] uppercase font-bold"
						>
							Invalid Type
						</TooltipContent>
					</Tooltip>
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
		const { inputs, isProcessing } = useNodeResult(id);
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
					"relative flex flex-col w-full h-full group/node",
					// Use standard ease for cleaner motion
					"transition-all duration-200 ease-out",
					dragging ? "shadow-lg scale-[1.01]" : "shadow-sm",
					{ "ring-1 ring-green-400/30": isProcessing },
					"bg-card border border-border",
					// Sharper corners for a more technical look to match rectangular handles
					"rounded-2xl",
					selected && "ring-1 ring-primary border-primary",
					props.className,
				)}
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
				<div className="flex flex-col h-full overflow-hidden">
					<div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/20 drag-handle cursor-grab active:cursor-grabbing">
						<div className="flex items-center gap-2.5 min-w-0">
							{Icon && (
								<div className="text-foreground/70">
									<Icon className="w-3.5 h-3.5" />
								</div>
							)}
							<div className="flex flex-col min-w-0">
								<span className="text-xs font-semibold text-foreground truncate">
									{node?.name}
									{props.id.substring(0, 6)}
								</span>
							</div>
						</div>
						<NodeMenu id={props.id} />
					</div>

					<div className="flex-1 p-2 nodrag nopan cursor-auto bg-card/50 rounded-3xl">
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

// ... CustomEdge and CustomConnectionLine remain largely unchanged
// unless you want to match the edge termination style to the rectangles.
// Assuming they are fine as is for now.

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
					strokeDasharray="4 4"
					className="opacity-60"
				/>
				<circle cx={toX} cy={toY} r={3} fill={strokeColor} />
			</g>
		);
	},
);

// Re-exporting Edge for context, assuming no changes needed to logic
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
	}: EdgeProps): JSX.Element => {
		const [edgePath] = getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
		});

		const color = useMemo(
			() => (selected ? "var(--primary)" : undefined),
			[selected],
		);

		return (
			<>
				{/* Hit area */}
				<BaseEdge
					path={edgePath}
					style={{ strokeWidth: 24, stroke: "transparent" }}
				/>
				<BaseEdge
					id={id}
					path={edgePath}
					markerEnd={markerEnd}
					style={{
						...style,
						strokeWidth: selected ? 3 : 1.5,
						stroke: color,
						opacity: selected ? 1 : 0.6,
					}}
				/>
			</>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };
