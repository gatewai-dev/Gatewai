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
import { type JSX, memo, type ReactNode, useCallback, useMemo } from "react";
import { PiCube } from "react-icons/pi";
import { useCanvasCtx } from "../canvas-ctx";
import { cn } from "../lib/utils";
import { useNodeRegistry } from "../node-registry-ctx";
import {
	useEdgeColor,
	useNodeResult,
	useNodeValidation,
} from "../processor-ctx";
import type { HandleState } from "../types";
import { NodeMenu } from "./node-menu";

const DEFAULT_COLOR = "#9ca3af";

// ─── Stable fallback for iconMap lookup ──────────────────────────────────────
// Defined outside any component so it's never recreated, preventing
// memo invalidation on BaseNode from the `?? { mainIcon: PiCube }` inline object.
const DEFAULT_ICON_ENTRY = { mainIcon: PiCube } as const;

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeHandleProps {
	handle: HandleEntityType;
	index: number;
	type: "source" | "target";
	status?: HandleState;
	nodeSelected?: boolean;
}

/**
 * Custom areEqual for NodeHandle memo.
 *
 * The critical fix: `status` is a plain object from the processor context.
 * On every drag frame the parent re-renders and produces a new `status`
 * object reference even though its *values* haven't changed. Default memo
 * (reference equality) would re-render every handle every frame.
 *
 * By comparing the three scalar fields that actually affect rendering we
 * short-circuit the cascade entirely.
 */
const areNodeHandlePropsEqual = (
	prev: NodeHandleProps,
	next: NodeHandleProps,
): boolean => {
	// Fast path: nothing changed
	if (
		prev.handle === next.handle &&
		prev.index === next.index &&
		prev.type === next.type &&
		prev.nodeSelected === next.nodeSelected &&
		prev.status === next.status
	) {
		return true;
	}

	// Status deep-equal on scalar fields (avoids referential churn)
	const sameStatus =
		prev.status?.color === next.status?.color &&
		prev.status?.valid === next.status?.valid &&
		prev.status?.isConnected === next.status?.isConnected;

	return (
		prev.handle === next.handle &&
		prev.index === next.index &&
		prev.type === next.type &&
		prev.nodeSelected === next.nodeSelected &&
		sameStatus
	);
};

const NodeHandle = memo(
	({ handle, index, type, status, nodeSelected }: NodeHandleProps) => {
		const isTarget = type === "target";
		const { onHandlesDelete } = useCanvasCtx();

		// FIX: Wrap the delete callback in useCallback so the ContextMenuItem
		// doesn't re-render due to a fresh function reference each render.
		const handleDelete = useCallback(
			() => onHandlesDelete([handle.id]),
			[handle.id, onHandlesDelete],
		);

		const validation = useNodeValidation(handle.nodeId);

		// FIX: Memoize errorCode so downstream derived values don't recompute
		// when the validation map reference changes but our handle's entry hasn't.
		const errorCode = useMemo(
			() => validation?.[handle.id],
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[validation, handle.id],
		);

		const isRequiredErr = errorCode === "missing_connection";

		const {
			style: handleStyle,
			isMultiColor,
			gradientColors,
		} = useMemo(
			() => getHandleStyle(status, handle.dataTypes),
			[status, handle.dataTypes],
		);

		// FIX: Memoize derived color so it doesn't allocate a new string reference
		// every render when inputs haven't changed.
		const activeColor = useMemo(() => {
			if (isRequiredErr) return dataTypeColors[handle.dataTypes[0]]?.hex;
			return status?.color || dataTypeColors[handle.dataTypes[0]]?.hex;
		}, [isRequiredErr, status?.color, handle.dataTypes]);

		const topPosition = (index + 1) * 32 + 20;

		// FIX: Memoize tooltipContent – it's derived from status + errorCode and
		// was previously recomputed on every render unconditionally.
		const tooltipContent = useMemo<string | null>(() => {
			if (!status || status.valid || !errorCode) return null;
			if (errorCode === "type_mismatch") return "Invalid Type";
			if (errorCode === "missing_connection") return "Missing Required";
			if (errorCode === "invalid_source") return "Invalid Source";
			return "Invalid";
		}, [status, errorCode]);

		const animationClasses =
			"hover:scale-110 transition-transform duration-75 origin-center";

		// FIX: Memoize the gradient wrapper style object so it doesn't trigger
		// re-renders on child elements that compare style by reference.
		const gradientWrapperStyle = useMemo<React.CSSProperties>(
			() => ({
				width: "10px",
				height: "18px",
				borderRadius: "2px",
				background: isMultiColor
					? getMultiColorGradient(gradientColors)
					: undefined,
				top: "-9px",
				left: "-5px",
			}),
			[isMultiColor, gradientColors],
		);

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
				<div className="absolute inset-0" style={gradientWrapperStyle} />
				{/* Handle on top */}
				<div className="relative">{handleElement}</div>
			</div>
		) : (
			handleElement
		);

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
						onSelect={handleDelete}
					>
						<TrashIcon className="mr-1 h-4 w-4" />
						<span className="text-xs">Delete Handle</span>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		);
	},
	areNodeHandlePropsEqual, // <── key: value-based comparison instead of referential
);

// ─── Stable status extractor ──────────────────────────────────────────────────
/**
 * Extracts the scalar fields we care about from a HandleState so that
 * useMemo / areEqual comparisons work on primitives, not object references.
 *
 * This is used by BaseNode to produce per-handle status props that only
 * change when the actual values change, breaking the drag re-render cascade.
 */
function extractHandleStatusKey(s: HandleState | undefined) {
	if (!s) return undefined;
	return `${s.color}|${s.valid}|${s.isConnected}`;
}

// ─── Handle list sub-component ────────────────────────────────────────────────
/**
 * Separated so that handle lists can bail out of re-rendering independently
 * of the parent BaseNode (e.g., when only `dragging` changed on the parent).
 */
interface HandleListProps {
	handles: HandleEntityType[];
	handleStatus: Record<string, HandleState>;
	type: "source" | "target";
	nodeSelected: boolean;
}

/**
 * Custom areEqual for HandleList.
 *
 * Re-renders only when:
 * - The handles array reference changes (contents changed in store)
 * - Any individual handle's status scalar values change
 * - Selection state changes
 *
 * Crucially does NOT re-render when:
 * - `handleStatus` map gets a new reference but all values are the same
 *   (which is the common case during drag of an unrelated node)
 */
const areHandleListPropsEqual = (
	prev: HandleListProps,
	next: HandleListProps,
): boolean => {
	if (prev.handles !== next.handles) return false;
	if (prev.type !== next.type) return false;
	if (prev.nodeSelected !== next.nodeSelected) return false;

	// Check each handle's status by value, not reference
	for (const handle of prev.handles) {
		if (
			extractHandleStatusKey(prev.handleStatus[handle.id]) !==
			extractHandleStatusKey(next.handleStatus[handle.id])
		) {
			return false;
		}
	}

	return true;
};

const HandleList = memo(
	({ handles, handleStatus, type, nodeSelected }: HandleListProps) => (
		<>
			{handles.map((handle, i) => (
				<NodeHandle
					key={handle.id}
					handle={handle}
					index={i}
					type={type}
					status={handleStatus[handle.id]}
					nodeSelected={nodeSelected}
				/>
			))}
		</>
	),
	areHandleListPropsEqual,
);

// ─── BaseNode ─────────────────────────────────────────────────────────────────

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
		const nodeType = useAppSelector((state) => selectNode(state)?.type);
		const nodeName = useAppSelector((state) => selectNode(state)?.name);

		const { handleStatus } = useNodeResult(id);

		const { inputHandles, outputHandles } = useMemo(() => {
			const sorted = [...handles].sort((a, b) => {
				const orderA = a.order ?? Infinity;
				const orderB = b.order ?? Infinity;

				if (orderA !== orderB) return orderA - orderB;
				return (a.createdAt || "").localeCompare(b.createdAt || "");
			});

			return {
				inputHandles: sorted.filter((h) => h.type === "Input"),
				outputHandles: sorted.filter((h) => h.type === "Output"),
			};
		}, [handles]);

		const { iconMap } = useNodeRegistry();

		// FIX: Use stable DEFAULT_ICON_ENTRY constant instead of inline `??` object.
		// The inline `{ mainIcon: PiCube }` was a new object every render,
		// making `MainIcon` always a new reference and preventing downstream memos
		// from bailing out.
		const { mainIcon: MainIcon } =
			iconMap[nodeType || ""] ?? DEFAULT_ICON_ENTRY;

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
				{/*
				  FIX: Replaced inline .map() with <HandleList> memoized component.
				  Previously, every re-render of BaseNode (e.g. dragging=true frames)
				  would call .map() producing new ReactElement instances, bypassing
				  NodeHandle memo entirely because React reconciles by position, not
				  identity. HandleList's custom areEqual now gates this.
				*/}
				<div className="absolute inset-y-0 left-0 w-0">
					<HandleList
						handles={inputHandles}
						handleStatus={handleStatus}
						type="target"
						nodeSelected={selected}
					/>
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
									{nodeName}
								</span>
							</div>
						</div>
						<NodeMenu id={props.id} />
					</div>

					<div className="flex-1 nodrag nopan cursor-auto bg-transparent p-0.5">
						{props.children}
					</div>
				</div>

				{/* Outputs - right side */}
				<div className="absolute inset-y-0 right-0 w-0">
					<HandleList
						handles={outputHandles}
						handleStatus={handleStatus}
						type="source"
						nodeSelected={selected}
					/>
				</div>
			</div>
		);
	},
);

// ─── Connection Line ──────────────────────────────────────────────────────────

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

// ─── Custom Edge ──────────────────────────────────────────────────────────────

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

		const processorColor = useEdgeColor(source, sourceHandleId ?? "");

		const color = selected
			? "var(--primary)"
			: processorColor || "var(--border)";

		// FIX: Memoize the style object for the visible edge so the BaseEdge
		// component doesn't re-render due to a new style object reference every
		// frame during drag (even when selected/color haven't changed).
		const edgeStyle = useMemo(
			() => ({
				...style,
				strokeWidth: selected ? 3 : 1.5,
				stroke: color,
				opacity: selected ? 1 : 0.6,
				transition: "stroke 0.3s ease",
			}),
			// `style` spread: in practice this prop is usually a stable empty object
			// so excluding it from deps would be fine, but we keep it correct here.
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[selected, color, style],
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
					style={edgeStyle}
				/>
			</>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };
