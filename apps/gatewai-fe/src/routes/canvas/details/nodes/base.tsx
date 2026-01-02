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

const getColorForType = (type: string) => {
	return (
		dataTypeColors[type] || {
			bg: "bg-gray-500",
			stroke: "stroke-gray-500",
			hex: "#6b7280",
			text: "text-gray-500",
		}
	);
};

const getHandleStyles = (
	type: string,
	isConnected: boolean,
	isInvalid: boolean,
) => {
	const config = dataTypeColors[type] || dataTypeColors["Any"];
	const isGenericLayer = ["DesignLayer", "VideoLayer", "File", "Any"].includes(
		type,
	);

	return cn(
		"w-3.5! h-3.5! transition-all duration-300 hover:scale-125 border-2",
		// Invalid State: Red ring, no background, specific border
		isInvalid
			? "border-red-500 ring-4 ring-red-500/30 bg-transparent animate-pulse"
			: "",
		// Connection State Logic
		!isInvalid && (isConnected ? "bg-current" : "bg-transparent"),
		// Neutral state for specific types
		!isInvalid && !isConnected && isGenericLayer
			? "border-slate-200 bg-white"
			: "",
	);
};

const NodeHandle = memo(
	({
		handle,
		index,
		type,
		isValid,
		hasValue,
	}: {
		handle: HandleEntityType;
		index: number;
		type: "source" | "target";
		isValid: boolean;
		hasValue: boolean;
	}) => {
		const primaryType = handle.dataTypes[0] || "Any";
		const color = getColorForType(primaryType);
		const isTarget = type === "target";
		const isInvalid = !isValid;

		// Design Logic: Determine the colors based on state
		// If invalid, force Red. Otherwise, use the data-type hex.
		const borderColor = color.hex;

		// Background logic:
		// 1. Invalid = Transparent
		// 2. Has Value = Solid Data Color
		// 3. Empty = White
		const backgroundColor = isInvalid
			? "transparent"
			: hasValue
				? color.hex
				: "transparent";

		return (
			<div
				className={cn(
					"absolute z-10 flex items-center group",
					isTarget ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
				)}
				style={{ top: `${(index + 1) * 30 + 20}px` }}
			>
				<Handle
					id={handle.id}
					type={type}
					position={isTarget ? Position.Left : Position.Right}
					// Use inline styles for the dynamic hex colors to guarantee they render
					style={{
						border: `2px solid ${borderColor}`,
						backgroundColor: backgroundColor,
					}}
					className={cn(
						"w-3.5! h-3.5! transition-all duration-300 hover:scale-125",
						// Use Tailwind for the "System States" (Ring and Animation)
						isInvalid && "ring-2 ring-offset-2 ring-red-500/70 animate-pulse",
					)}
				/>

				{/* Label Tooltip */}
				<span
					className={cn(
						"absolute whitespace-nowrap px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-0 transition-all duration-200 pointer-events-none group-hover:opacity-100",
						isTarget ? "right-5 text-right" : "left-5 text-left",
					)}
					style={{ color: borderColor }}
				>
					{handle.label || primaryType}
					{handle.required && <span className="ml-0.5">*</span>}
				</span>
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
		const handles = useAppSelector(makeSelectHandlesByNodeId(id));
		const node = useAppSelector(makeSelectNodeById(id));
		const { inputs } = useNodeResult(id);

		const isValid = (id: HandleEntityType["id"]) => {
			const input = inputs.get(id);
			return input?.connectionValid && input.outputItem != null;
		};

		const hasValue = (id: HandleEntityType["id"]) => {
			const input = inputs.get(id);
			return input?.outputItem?.data != null;
		};
		// Sort handles by order
		const { inputHandles, outputHandles } = useMemo(() => {
			const sorted = handles.sort((a, b) => a.order - b.order);
			return {
				inputHandles: sorted.filter((h) => h.type === "Input"),
				outputHandles: sorted.filter((h) => h.type === "Output"),
			};
		}, [handles]);

		const nodeBackgroundColor = "bg-background";
		const Icon =
			node && (NODE_ICON_MAP[node?.type](node) || NODE_ICON_MAP.File(node));

		return (
			<div
				className={cn(
					`relative drag-handle ${nodeBackgroundColor} rounded-2xl shadow-md w-full h-full transition-all duration-200 group`,
					{
						"selected ring-primary/30 ring box-border bg-background-selected!":
							selected,
					},
					props.className,
				)}
			>
				{inputHandles.map((handle, i) => (
					<NodeHandle
						key={handle.id}
						handle={handle}
						index={i}
						type="target"
						isValid={isValid(handle.id) ?? true}
						hasValue={hasValue(handle.id)}
					/>
				))}

				<div className="px-2 py-2 h-[calc(100%-1rem)]">
					<div className="header-section flex justify-between items-center mb-3 px-1">
						<div className="flex items-center gap-2">
							{Icon && <Icon />}
							<div className="text-xs text-node-title">
								{node?.name} {node?.id}
							</div>
						</div>
						<NodeMenu {...props} />
					</div>
					<div className="nodrag nopan pointer-events-auto! h-[calc(100%-1rem)]">
						{props.children}
					</div>
				</div>

				{outputHandles.map((handle, i) => (
					<NodeHandle
						key={handle.id}
						handle={handle}
						index={i}
						type="source"
						isValid={true}
						hasValue={true}
					/>
				))}
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
	}: ConnectionLineComponentProps<Node>): JSX.Element => {
		const [edgePath] = getBezierPath({
			sourceX: fromX,
			sourceY: fromY,
			sourcePosition: fromPosition,
			targetX: toX,
			targetY: toY,
			targetPosition: toPosition,
		});

		return (
			<g>
				<path
					fill="none"
					stroke="#6b7280"
					strokeWidth={3}
					d={edgePath}
					strokeDasharray="5 15"
				>
					<animate
						attributeName="stroke-dashoffset"
						values="0;-20"
						dur="2s"
						repeatCount="indefinite"
						calcMode="linear"
					/>
				</path>
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
	markerEnd?: string;
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
	}: CustomEdgeProps): JSX.Element => {
		const [edgePath] = getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
		});
		return (
			<BaseEdge
				path={edgePath}
				id={id}
				style={{
					...style,
					strokeWidth: 3,
				}}
				className="react-flow__edge-path  hover:stroke-[15px]! hover:opacity-80"
				markerEnd={markerEnd}
			/>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };
