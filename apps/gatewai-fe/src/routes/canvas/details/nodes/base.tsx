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
import { dataTypeColors } from "@/config/colors";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
} from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import type { HandleState } from "../graph-engine/node-graph-processor";
import {
	useEdgeColor,
	useNodeResult,
	useNodeValidation,
} from "../graph-engine/processor-ctx";
import { NODE_ICON_MAP } from "../node-templates/node-palette/icon-map";
import { NodeMenu } from "./node-menu";

const DEFAULT_COLOR = "#ccc";

/**
 * Generates styles for the handle based on processor state.
 */
export const getHandleStyle = (
	status: HandleState | undefined,
	defColors: string[],
): React.CSSProperties => {
	const baseDimensions = {
		width: "10px",
		height: "18px",
		borderRadius: "2px",
	};

	// Get the resolved color if the handle has a specific type/result
	const resolvedColor =
		status?.color || (status?.type ? dataTypeColors[status.type]?.hex : null);

	// A handle is "Multi-Type" only if it hasn't resolved to a single type yet
	const isMultiType = !resolvedColor && defColors.length > 1;

	// Helper to generate gradient segments
	const getMultiColorGradient = () => {
		const colors = defColors.map(
			(t) =>
				dataTypeColors[t]?.hex || dataTypeColors["Any"]?.hex || DEFAULT_COLOR,
		);
		const segments = colors.map((color, i) => {
			const start = (i / colors.length) * 100;
			const end = ((i + 1) / colors.length) * 100;
			return `${color} ${start}%, ${color} ${end}%`;
		});
		return `conic-gradient(${segments.join(", ")})`;
	};

	// 1. Error state (Connected but invalid)
	if (status && !status.valid && status.isConnected) {
		return {
			...baseDimensions,
			backgroundColor: "var(--destructive)",
			border: "1px solid var(--background)",
			boxShadow: "0 0 0 2px var(--destructive), 0 0 8px var(--destructive/50)",
		};
	}

	// 2. Disconnected state
	if (!status?.isConnected) {
		if (isMultiType) {
			return {
				...baseDimensions,
				backgroundColor: "transparent",
				border: "2px solid transparent",
				backgroundImage: `linear-gradient(var(--card), var(--card)), ${getMultiColorGradient()}`,
				backgroundOrigin: "border-box",
				backgroundClip: "padding-box, border-box",
			};
		}

		const color =
			resolvedColor || dataTypeColors[defColors[0]]?.hex || DEFAULT_COLOR;
		return {
			...baseDimensions,
			backgroundColor: "var(--card)",
			border: `2px solid ${color}`,
		};
	}

	// 3. Connected/Resolved state
	if (resolvedColor) {
		return {
			...baseDimensions,
			backgroundColor: resolvedColor,
			border: "1px solid var(--background)",
			boxShadow: `0 0 0 1px ${resolvedColor}80`,
		};
	}

	// 4. Connected but Ambiguous (Still Multi-type)
	if (isMultiType) {
		return {
			...baseDimensions,
			backgroundImage: getMultiColorGradient(),
			border: "1px solid var(--background)",
		};
	}

	// Fallback
	return {
		...baseDimensions,
		backgroundColor: DEFAULT_COLOR,
		border: "1px solid var(--background)",
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

		const validation = useNodeValidation(handle.nodeId);
		const errorCode = validation?.[handle.id];
		const isRequiredErr = errorCode === "missing_connection";
		const handleStyle = useMemo(
			() => getHandleStyle(status, handle.dataTypes),
			[status, handle.dataTypes],
		);
		console.log({ handleStyle });
		let activeColor = status?.color || dataTypeColors[handle.dataTypes[0]]?.hex;
		if (isRequiredErr) {
			activeColor = dataTypeColors[handle.dataTypes[0]]?.hex;
		}
		const topPosition = (index + 1) * 32 + 20;

		const handleComponent = (
			<Handle
				id={handle.id}
				type={type}
				position={isTarget ? Position.Left : Position.Right}
				style={handleStyle}
				className={cn(
					status && !status.valid && status.isConnected && "animate-pulse",
					"hover:scale-110 transition-transform duration-75",
				)}
			/>
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
						className="text-[10px] font-bold uppercase tracking-wider shadow-sm leading-none"
						style={{
							color: activeColor,
							textShadow: "0 1px 2px rgba(0,0,0,0.1)",
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
					dragging ? "shadow-lg scale-[1.01]" : "shadow-sm",
					"bg-card border border-border",
					"rounded-2xl",
					selected && "ring-1 ring-primary border-primary",
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
				<div className="flex flex-col h-full overflow-hidden">
					<div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/20 drag-handle cursor-grab active:cursor-grabbing">
						<div className="flex items-center gap-2.5 min-w-0">
							{MainIcon && (
								<div className="text-foreground">
									<MainIcon className="w-5 h-5" />
								</div>
							)}
							<div className="flex flex-col min-w-0">
								<span className="text-xs font-semibold text-foreground truncate">
									{node?.name}
								</span>
							</div>
						</div>
						<NodeMenu id={props.id} />
					</div>

					<div className="flex-1 p-2 nodrag nopan cursor-auto bg-card/50 rounded-3xl">
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

		// Use DEFAULT_COLOR (#ccc) as the fallback instead of var(--border)
		const color = useMemo(
			() => (selected ? "var(--primary)" : processorColor || DEFAULT_COLOR),
			[selected, processorColor],
		);

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
