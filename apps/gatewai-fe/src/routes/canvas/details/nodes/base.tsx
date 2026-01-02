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

export const getHandleStyle = (
	types: string[],
	isConnected: boolean,
	connectedType?: string, // The type of the actual data currently in the handle
	borderWidth: string = "2px",
): React.CSSProperties => {
	// If connected, return a solid color style
	if (isConnected && connectedType) {
		const color = dataTypeColors[connectedType]?.hex || "#6b7280";
		return {
			border: `${borderWidth} solid ${color}`,
			backgroundColor: color,
		};
	}

	// If not connected, show the multi-color border
	const segmentSize = 100 / Math.max(types.length, 1);
	const gradientStops =
		types.length > 0
			? types
					.map((type, index) => {
						const color = dataTypeColors[type]?.hex || "#6b7280";
						return `${color} ${index * segmentSize}% ${(index + 1) * segmentSize}%`;
					})
					.join(", ")
			: "#6b7280 0% 100%";

	return {
		border: `${borderWidth} solid transparent`,
		background: `
            linear-gradient(white, white) padding-box, 
            conic-gradient(${gradientStops}) border-box
        `,
		borderRadius: "9999px",
	};
};

const NodeHandle = memo(
	({
		handle,
		index,
		type,
		isValid,
		hasValue,
		connectedType, // New prop
	}: {
		handle: HandleEntityType;
		index: number;
		type: "source" | "target";
		isValid: boolean;
		hasValue: boolean;
		connectedType?: string;
	}) => {
		const isTarget = type === "target";
		const isInvalid = !isValid;

		// Calculate style:
		// If hasValue is true, it uses connectedType for solid color.
		// If hasValue is false, it uses handle.dataTypes for multi-color border.
		const handleStyle = useMemo(
			() => getHandleStyle(handle.dataTypes, hasValue, connectedType),
			[handle.dataTypes, hasValue, connectedType],
		);

		// For the label text color, use the active type or the first allowed type
		const activeColor =
			dataTypeColors[connectedType || handle.dataTypes[0] || "Any"]?.hex;

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
					style={handleStyle}
					className={cn(
						"w-3.5! h-3.5! border-none",
						// Red pulse only if strictly invalid
						isInvalid && "ring-2 ring-offset-2 ring-red-500 animate-pulse",
					)}
				/>

				<span
					className={cn(
						"absolute whitespace-nowrap px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-0 transition-all duration-200 pointer-events-none group-hover:opacity-100",
						isTarget ? "right-5 text-right" : "left-5 text-left",
					)}
					style={{ color: activeColor }}
				>
					{handle.label || connectedType || handle.dataTypes[0]}
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
			return input?.connectionValid;
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
					// Inside BaseNode.tsx mapping:
					<NodeHandle
						key={handle.id}
						handle={handle}
						index={i}
						type="target"
						isValid={isValid(handle.id) ?? true}
						hasValue={hasValue(handle.id)}
						// Pass the actual type from the processor result
						connectedType={inputs.get(handle.id)?.outputItem?.type}
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
