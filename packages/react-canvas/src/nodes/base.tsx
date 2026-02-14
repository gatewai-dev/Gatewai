import { dataTypeColors } from "@gatewai/core/types";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
	makeSelectNodeById,
	useAppSelector,
} from "@gatewai/react-store";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import {
	BaseEdge,
	type ConnectionLineComponentProps,
	type EdgeProps,
	getBezierPath,
	Handle,
	type Node,
	Position,
} from "@xyflow/react";
import { TrashIcon } from "lucide-react";
import { type JSX, memo, type ReactNode, useMemo } from "react";
import { useCanvasCtx } from "../canvas-ctx";
import { cn } from "../lib/utils";
import {
	useEdgeColor,
	useNodeResult,
	useNodeValidation,
} from "../processor-ctx";
import type { HandleState } from "../types";
import { NODE_ICON_MAP } from "./icon-map";
import { NodeMenu } from "./node-menu";

const DEFAULT_COLOR = "#9ca3af";

/**
 * Generates a conic-gradient CSS string for multiple colors.
 * Colors are split evenly around the circle.
 */
const getMultiColorGradient = (colors: string[]): string => {
	if (colors.length === 0) return DEFAULT_COLOR;
	if (colors.length === 1) return colors[0];

	const segmentSize = 360 / colors.length;
	const stops = colors
		.map((color, i) => {
			const start = i * segmentSize;
			const end = (i + 1) * segmentSize;
			return `${color} ${start}deg ${end}deg`;
		})
		.join(", ");

	return `conic-gradient(from 90deg, ${stops})`;
};

/**
 * Returns the hex colors for the given data types.
 */
const getColorsForTypes = (types: string[]): string[] => {
	return types
		.map((t) => dataTypeColors[t]?.hex)
		.filter((c): c is string => !!c);
};

/**
 * Handle style result with optional multi-color gradient.
 */
interface HandleStyleResult {
	style: React.CSSProperties;
	isMultiColor: boolean;
	gradientColors: string[];
}

const baseDimensions = {
	width: "10px",
	height: "18px",
	borderRadius: "2px",
};

/**
 * Generates styles for the handle based on processor state.
 * Returns style object plus multi-color info for gradient wrapper rendering.
 */
export const getHandleStyle = (
	status: HandleState | undefined,
	defColors: string[],
): HandleStyleResult => {
	const typeColors = getColorsForTypes(defColors);
	const isMultiType = typeColors.length > 1;
	const hasResolvedColor = !!status?.color;

	// 1. Error state (from validation or status, but only if connected)
	if (status && !status.valid && status.isConnected) {
		return {
			style: {
				...baseDimensions,
				backgroundColor: "var(--destructive)",
				border: "1px solid var(--background)",
				boxShadow:
					"0 0 0 2px var(--destructive), 0 0 8px var(--destructive/50)",
			},
			isMultiColor: false,
			gradientColors: [],
		};
	}

	// 2. Disconnected state
	if (!status?.isConnected) {
		// If multi-type AND no resolved color → use gradient wrapper
		if (isMultiType && !hasResolvedColor) {
			return {
				style: {
					width: "6px",
					height: "14px",
					borderRadius: "0px",
					backgroundColor: "var(--card)",
					border: "none", // Border handled by gradient wrapper
				},
				isMultiColor: true,
				gradientColors: typeColors,
			};
		}

		// Single type or resolved color → solid border
		const solidColor =
			status?.color ||
			typeColors[0] ||
			dataTypeColors["Any"]?.hex ||
			DEFAULT_COLOR;
		return {
			style: {
				...baseDimensions,
				backgroundColor: "var(--card)",
				border: `2px solid ${solidColor}`,
				boxShadow: "none",
			},
			isMultiColor: false,
			gradientColors: [],
		};
	}

	// 3. Connected state: Filled with the resolved active type color
	const color = status.color || DEFAULT_COLOR;
	return {
		style: {
			...baseDimensions,
			backgroundColor: color,
			border: "1px solid var(--background)",
			boxShadow: `0 0 0 1px ${color}80`,
			transition: "background-color 0.15s ease, box-shadow 0.15s ease",
		},
		isMultiColor: false,
		gradientColors: [],
	};
};

const NodeHandle = memo(
	({
		handle,
		index,
		type,
		status,
		nodeSelected,
	}: {
		handle: HandleEntityType;
		index: number;
		type: "source" | "target";
		status?: HandleState;
		nodeSelected?: boolean;
	}) => {
		const isTarget = type === "target";
		const { onHandlesDelete } = useCanvasCtx();

		const validation = useNodeValidation(handle.nodeId);
		const errorCode = validation?.[handle.id];
		const isRequiredErr = errorCode === "missing_connection";

		const {
			style: handleStyle,
			isMultiColor,
			gradientColors,
		} = useMemo(
			() => getHandleStyle(status, handle.dataTypes),
			[status, handle.dataTypes],
		);

		let activeColor = status?.color || dataTypeColors[handle.dataTypes[0]]?.hex;
		if (isRequiredErr) {
			activeColor = dataTypeColors[handle.dataTypes[0]]?.hex;
		}
		const topPosition = (index + 1) * 32 + 20;

		const animationClasses =
			"hover:scale-110 transition-transform duration-75 origin-center";

		const handleElement = (
			<Handle
				id={handle.id}
				type={type}
				position={isTarget ? Position.Left : Position.Right}
				style={handleStyle}
				className={cn(
					status && !status.valid && status.isConnected && "animate-pulse",
					!isMultiColor && animationClasses,
				)}
			/>
		);

		// Wrap handle in gradient container if multi-color
		const handleComponent = isMultiColor ? (
			<div className={cn("relative", animationClasses)}>
				{/* Gradient border background */}
				<div
					className="absolute inset-0"
					style={{
						width: "10px",
						height: "18px",
						borderRadius: "2px",
						background: getMultiColorGradient(gradientColors),
						top: "-9px",
						left: "-5px",
					}}
				/>
				{/* Handle on top */}
				<div className="relative">{handleElement}</div>
			</div>
		) : (
			handleElement
		);

		let tooltipContent: string | null = null;
		if (status && !status.valid && errorCode) {
			if (errorCode === "type_mismatch") {
				tooltipContent = "Invalid Type";
			} else if (errorCode === "missing_connection") {
				tooltipContent = "Missing Required";
			} else if (errorCode === "invalid_source") {
				tooltipContent = "Invalid Source";
			} else {
				tooltipContent = "Invalid";
			}
		}

		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						className={cn(
							"absolute z-50 flex items-center group/handle",
							isTarget ? "-left-[5px]" : "-right-[5px]",
						)}
						style={{ top: `${topPosition}px` }}
					>
						<div
							className={cn(
								"absolute -top-4 pointer-events-none opacity-0 transition-opacity duration-200 w-auto whitespace-nowrap",
								"group-hover/handle:opacity-100 group-hover/node:opacity-100",
								{ "opacity-100": nodeSelected },
								isTarget
									? "right-3 text-right origin-right"
									: "left-3 text-left origin-left",
							)}
						>
							<span
								className="text-[10px] font-bold uppercase tracking-wider shadow-sm leading-none bg-background/80 backdrop-blur-md px-1.5 py-0.5 rounded-sm border border-border/50"
								style={{
									color: activeColor,
									textShadow: "none",
								}}
							>
								{handle.label || handle.dataTypes[0]}
								{handle.required && (
									<span className="text-destructive text-lg ml-0.5">*</span>
								)}
							</span>
						</div>

						{tooltipContent ? (
							<Tooltip>
								<TooltipTrigger asChild>{handleComponent}</TooltipTrigger>
								<TooltipContent
									side={"bottom"}
									className="bg-destructive text-destructive-foreground border-none text-[10px] uppercase font-bold"
								>
									{tooltipContent}
								</TooltipContent>
							</Tooltip>
						) : (
							handleComponent
						)}
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent className="w-35">
					<ContextMenuItem
						disabled={handle.required || !isTarget}
						onSelect={() => onHandlesDelete([handle.id])}
					>
						<TrashIcon className="mr-1 h-4 w-4" />
						<span className="text-xs">Delete Handle</span>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
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

		const { handleStatus } = useNodeResult(id);

		const { inputHandles, outputHandles } = useMemo(() => {
			// Sort by .order (smaller number = higher position)
			// If order is missing/undefined → falls back to creation time
			const sorted = [...handles].sort((a, b) => {
				const orderA = a.order ?? Infinity;
				const orderB = b.order ?? Infinity;

				if (orderA !== orderB) {
					return orderA - orderB; // lower order number comes first (top)
				}

				// Fallback: older created items on top if orders are equal/missing
				return (a.createdAt || "").localeCompare(b.createdAt || "");
			});

			return {
				inputHandles: sorted.filter((h) => h.type === "Input"),
				outputHandles: sorted.filter((h) => h.type === "Output"),
			};
		}, [handles]);

		const { mainIcon: MainIcon } = NODE_ICON_MAP[node?.type] ?? {
			mainIcon: NODE_ICON_MAP.File.mainIcon,
			optionalIcons: [],
		};

		return (
			<div
				className={cn(
					"relative flex flex-col w-full h-full group/node",
					"rounded-xl transition-all duration-300",
					dragging
						? "shadow-2xl scale-[1.02] cursor-grabbing"
						: "shadow-lg hover:shadow-xl",
					"bg-card/90 backdrop-blur-md border border-white/10 dark:border-white/5",
					selected
						? "ring-1 ring-primary border-primary shadow-[0_0_20px_rgba(183,234,72,0.1)]"
						: "hover:border-white/30 dark:hover:border-white/20",
					props.className,
				)}
			>
				{/* Inputs - left side */}
				<div className="absolute inset-y-0 left-0 w-0">
					{inputHandles.map((handle, i) => (
						<NodeHandle
							key={handle.id}
							handle={handle}
							index={i} // ← now index follows the desired visual order
							type="target"
							status={handleStatus[handle.id]}
							nodeSelected={selected}
						/>
					))}
				</div>

				{/* Content Container */}
				<div className="flex flex-col h-full overflow-hidden rounded-xl">
					<div
						className={cn(
							"flex items-center justify-between px-3 py-2 border-b border-border/5 bg-muted/30 drag-handle cursor-grab active:cursor-grabbing",
							selected && "bg-primary/5",
						)}
					>
						<div className="flex items-center gap-3 min-w-0">
							{MainIcon && (
								<div
									className={cn(
										"text-muted-foreground transition-colors duration-300",
										selected
											? "text-primary"
											: "group-hover/node:text-foreground",
									)}
								>
									<MainIcon className="w-5 h-5" />
								</div>
							)}
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-semibold text-foreground/90 truncate tracking-tight">
									{node?.name}
								</span>
							</div>
						</div>
						<NodeMenu id={props.id} />
					</div>

					<div className="flex-1 p-2 nodrag nopan cursor-auto bg-transparent">
						{props.children}
					</div>
				</div>

				{/* Outputs - right side */}
				<div className="absolute inset-y-0 right-0 w-0">
					{outputHandles.map((handle, i) => (
						<NodeHandle
							key={handle.id}
							handle={handle}
							index={i} // ← index now respects .order
							type="source"
							status={handleStatus[handle.id]}
							nodeSelected={selected}
						/>
					))}
				</div>
			</div>
		);
	},
);

BaseNode.displayName = "BaseNode";

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
					strokeDasharray="4 4"
					className="opacity-60"
				/>
				<circle cx={toX} cy={toY} r={3} fill={strokeColor} />
			</g>
		);
	},
);

const CustomEdge = memo(
	({
		id,
		source,
		sourceHandleId,
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

		// Fetch the color dynamically from the processor based on the source handle
		const processorColor = useEdgeColor(source, sourceHandleId ?? "");

		const color = selected
			? "var(--primary)"
			: processorColor || "var(--border)";

		return (
			<>
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
						transition: "stroke 0.3s ease",
					}}
				/>
			</>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };
