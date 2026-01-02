import {
	BaseEdge,
	type ConnectionLineComponentProps,
	type EdgeProps,
	getBezierPath,
	Handle,
	type Node,
	type NodeProps,
	Position,
} from "@xyflow/react";
import { type JSX, memo, type ReactNode, useMemo } from "react";
import { dataTypeColors } from "@/config";
import { cn } from "@/lib/utils";
import type { CanvasDetailsNode } from "@/rpc/types";
import { useAppSelector } from "@/store";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
} from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { NODE_ICON_MAP } from "../../node-templates/node-palette/icon-map";
import { useNodeResult } from "../processor/processor-ctx";
import { NodeMenu } from "./node-menu";

// --- Helpers ---

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
			boxShadow: "0 0 0 2px var(--destructive), 0 0 8px var(--destructive)",
		};
	}

	// 2. Connected/Has Value State (Solid Fill)
	if (isConnected || connectedType) {
		const color = getTypeColor(connectedType || types[0]);
		return {
			backgroundColor: color,
			border: "2px solid var(--background)",
			boxShadow: `0 0 0 1px ${color}40`,
		};
	}

	// 3. Unconnected Multi-Type State (Hollow with Conic Border)
	if (types.length > 1) {
		const segmentSize = 100 / types.length;
		const gradientStops = types
			.map((type, index) => {
				const color = getTypeColor(type);
				return `${color} ${index * segmentSize}% ${(index + 1) * segmentSize}%`;
			})
			.join(", ");

		return {
			backgroundColor: "var(--background)",
			backgroundClip: "padding-box",
			border: "3px solid transparent",
			backgroundImage: `linear-gradient(var(--background), var(--background)), conic-gradient(${gradientStops})`,
			backgroundOrigin: "border-box",
		};
	}

	// 4. Unconnected Single Type (Hollow Ring)
	const color = getTypeColor(types[0]);
	return {
		backgroundColor: "var(--background)",
		border: `3px solid ${color}`,
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

		return (
			<div
				className={cn(
					"absolute z-50 flex items-center group/handle will-change-transform",
					isTarget ? "-left-[5px]" : "-right-[5px]",
				)}
				style={{ top: `${topPosition}px` }}
			>
				{/* External Label */}
				<div
					className={cn(
						"absolute -top-8 whitespace-nowrap py-0 rounded-lg transition-all duration-200 ease-out pointer-events-none",
						isTarget
							? "right-2  flex-row-reverse text-right origin-right"
							: "left-2 text-left origin-left",
						nodeSelected
							? " backdrop-blur-md opacity-100 scale-110 shadow-sm"
							: "opacity-40 scale-95",
					)}
				>
					<span
						className="text-xs font-bold uppercase tracking-widest leading-none"
						style={{ color: activeColor }}
					>
						{handle.label || connectedType || handle.dataTypes[0]}
						{handle.required && <span className="ml-0.5">*</span>}
					</span>
				</div>

				<Handle
					id={handle.id}
					type={type}
					position={isTarget ? Position.Left : Position.Right}
					style={handleStyle}
					className={cn(
						"w-4! h-4! rounded-full transition-shadow duration-200 border-none",
						!isValid &&
							"animate-pulse ring-2 ring-destructive ring-offset-2 ring-offset-background",
					)}
				/>
			</div>
		);
	},
);

const BaseNode = memo(
	(
		props: NodeProps<Node<CanvasDetailsNode>> & {
			children?: ReactNode;
			className?: string;
		},
	) => {
		const { selected, id } = props;

		const selectHandles = useMemo(() => makeSelectHandlesByNodeId(id), [id]);
		const handles = useAppSelector(selectHandles);
		const selectNode = useMemo(() => makeSelectNodeById(id), [id]);
		const node = useAppSelector(selectNode);
		const { inputs } = useNodeResult(id);

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
					"relative flex flex-col w-full h-full transition-shadow duration-300",
					"bg-card/75 backdrop-blur-2xl border border-border/40",
					"rounded-3xl shadow-sm",
					"group hover:border-border/80",
					selected &&
						"ring-2 ring-primary/40 ring-offset-4 ring-offset-background border-primary/50 shadow-lg",
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
							isValid={inputs.get(handle.id)?.connectionValid ?? true}
							hasValue={inputs.get(handle.id)?.outputItem?.data != null}
							connectedType={inputs.get(handle.id)?.outputItem?.type}
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
									ID: {node?.id.slice(-6)}
								</span>
							</div>
						</div>
						<NodeMenu {...props} />
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
