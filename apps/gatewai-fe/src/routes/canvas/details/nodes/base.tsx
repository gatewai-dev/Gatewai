import {
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
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { NodeMenu } from "./node-menu";
import { NODE_ICON_MAP } from "../../node-templates/node-palette/icon-map";

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

		// Sort handles by order
		const { inputs, outputs } = useMemo(() => {
			const sorted = handles.sort((a, b) => a.order - b.order);
			return {
				inputs: sorted.filter((h) => h.type === "Input"),
				outputs: sorted.filter((h) => h.type === "Output"),
			};
		}, [handles]);

		const nodeBackgroundColor = "bg-background";
		const Icon = NODE_ICON_MAP[node?.type] || NODE_ICON_MAP.File;

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
				{inputs.map((handle, i) => {
					const primaryType =
						handle.dataTypes.length > 1 ? "Any" : handle.dataTypes[0] || "Any";
					const color = getColorForType(primaryType);
					const topPosition = `${(i + 1) * 30 + 20}px`;

					return (
						<div
							key={handle.id}
							className="absolute left-0 z-10"
							style={{ top: topPosition, transform: "translateX(-100%)" }}
						>
							<Handle
								id={handle.id}
								type="target"
								position={Position.Left}
								tabIndex={0}
								style={{
									background: "transparent",
									border: `2px dashed ${color.hex}`,
								}}
								className={`w-5 h-5 flex items-center justify-center transition-all duration-200 left-[50%]! rounded-none!`}
							/>
							<span
								className={`absolute left-0 -top-5 translate-x-0 group-hover:-translate-x-full 
              group-focus:-translate-x-full group-focus-within:-translate-x-full in-[.selected]:-translate-x-full 
              px-1 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100
                group-focus-within:opacity-100 in-[.selected]:opacity-100 transition-all duration-200 pointer-events-none
                whitespace-nowrap font-medium text-right`}
								style={{ color: color.hex }}
							>
								{handle.label || handle.dataTypes.join(" | ")}
								{handle.required && "*"}
							</span>
						</div>
					);
				})}

				<div className="px-2 py-2 h-[calc(100%-1rem)]">
					<div className="header-section flex justify-between items-center mb-3 px-1">
						<div className="flex items-center gap-2">
							<Icon className="w-4 h-4 shrink-0 " />
							<div className="text-xs font-semibold text-node-title">
								{node?.name} {node?.id}
							</div>
						</div>
						<NodeMenu {...props} />
					</div>
					<div className="nodrag nopan pointer-events-auto! h-[calc(100%-1rem)]">
						{props.children}
					</div>
				</div>

				{outputs.map((handle, i) => {
					const primaryType =
						handle.dataTypes.length > 1 ? "Any" : handle.dataTypes[0] || "Any";
					const color = getColorForType(primaryType);
					const topPosition = `${(i + 1) * 30 + 20}px`;

					return (
						<div
							key={handle.id}
							className="absolute right-0 z-10"
							style={{ top: topPosition }}
						>
							<Handle
								id={handle.id}
								type="source"
								position={Position.Right}
								tabIndex={0}
								style={{
									background: "transparent",
									border: `2px dashed ${color.hex}`,
								}}
								className={`w-5 h-5 flex items-center justify-center transition-all duration-200 rounded-none! right-[50%]!`}
							/>
							<span
								className={`
                absolute right-0 -top-5 translate-x-0 group-hover:translate-x-full
                group-focus:translate-x-full group-focus-within:translate-x-full in-[.selected]:translate-x-full
                px-1 py-1 text-xs opacity-0 group-hover:opacity-100
                group-focus:opacity-100 group-focus-within:opacity-100 in-[.selected]:opacity-100
                transition-all duration-200 pointer-events-none whitespace-nowrap font-medium text-left`}
								style={{ color: color.hex }}
							>
								{handle.label || handle.dataTypes.join(" | ")}
							</span>
						</div>
					);
				})}
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
			<g>
				<path
					id={id}
					style={{
						...style,
						strokeWidth: 3,
					}}
					className="react-flow__edge-path fill-none hover:stroke-[15px]! hover:opacity-80"
					d={edgePath}
					markerEnd={markerEnd}
				/>
			</g>
		);
	},
);

export { BaseNode, CustomEdge, CustomConnectionLine };