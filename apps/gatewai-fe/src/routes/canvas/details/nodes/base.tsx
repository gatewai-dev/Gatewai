import { memo, useMemo, type JSX, type ReactNode } from 'react';
import { Handle, Position, getBezierPath, type EdgeProps, type NodeProps, type Node, type ConnectionLineComponentProps, useEdges } from '@xyflow/react';
import type { CanvasDetailsNode } from '@/rpc/types';
import { useAppSelector } from '@/store';
import { makeSelectHandleById, makeSelectHandlesByNodeId } from '@/store/handles';
import { dataTypeColors } from '@/config';
import { NodeMenu } from './node-menu';
import { makeSelectEdgeById } from '@/store/edges';
import { useNodeInputValidation } from './hooks/use-node-input-validation';
import type { NodeResult } from '@gatewai/types';
import { cn } from '@/lib/utils';
import { useMultipleNodeResults, useNodeResult } from '../processor/processor-ctx';
import { makeSelectNodeById } from '@/store/nodes';

const getColorForType = (type: string) => {
  return dataTypeColors[type] || { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' };
};



const getActualType = (result: NodeResult | null, handleId: string) => {
  if (!result) return null;
  const selectedIndex = result.selectedOutputIndex ?? 0;
  const output = result.outputs?.[selectedIndex];
  if (!output) return null;
  const item = output.items?.find((it) => it.outputHandleId === handleId);
  return item?.type ?? null;
};

const BaseNode = memo((props: NodeProps<Node<CanvasDetailsNode>> & {
  children?: ReactNode;
  className?: string;
}) => {
  const { selected, id } = props;
  const handles = useAppSelector(makeSelectHandlesByNodeId(id));
  const validationErrors = useNodeInputValidation(id);
  const edges = useEdges();
  const node = useAppSelector(makeSelectNodeById(id));

  // 1. Separate and Sort Handles
  // We use useMemo to avoid re-sorting on every render unless data.handles changes
  const { inputs, outputs } = useMemo(() => {
    // Sort by 'order' property from DB
    const sorted = handles.sort((a, b) => a.order - b.order);
    return {
      inputs: sorted.filter(h => h.type === 'Input'),
      outputs: sorted.filter(h => h.type === 'Output')
    };
  }, [handles]);

  const connectedSources = useMemo(() => {
    const sources: Record<string, string> = {};
    inputs.forEach(handle => {
      const edge = edges.find(e => e.target === id && e.targetHandle === handle.id);
      if (edge) {
        sources[handle.id] = edge.source;
      }
    });
    return sources;
  }, [inputs, edges, id]);

  const allRelevantNodeIds = useMemo(() => {
    const ids = new Set<string>([id]);
    Object.values(connectedSources).forEach(s => ids.add(s));
    return Array.from(ids);
  }, [id, connectedSources]);

  const nodeStates = useMultipleNodeResults(allRelevantNodeIds);

  const ownResult = nodeStates[id]?.result ?? null;

  const nodeBackgroundColor = 'bg-background';

  return (
    <div
      tabIndex={0}
      className={cn(
        `relative drag-handle ${nodeBackgroundColor} rounded-2xl shadow-md w-full h-full transition-all duration-200 group`,
        {'selected ring-primary/40 ring box-border': selected},
        props.className
      )}
    >
      {inputs.map((handle, i) => {
        let actualType: string | null = null;
        const edge = edges.find(edge => edge.target === id && edge.targetHandle === handle.id);
        const isConnected = !!edge;
        if (isConnected && edge) {
          const sourceNodeId = edge.source;
          const sourceResult = nodeStates[sourceNodeId]?.result ?? null;
          actualType = getActualType(sourceResult, edge.sourceHandle!);
        }
        const primaryType = handle.dataTypes.length > 1 ? 'Any' : handle.dataTypes[0] || 'Any';
        const displayType = actualType ?? primaryType;
        const color = getColorForType(displayType);
        const topPosition = `${(i + 1) * (30) + 20}px`;
        const error = validationErrors.find(err => err.handleId === handle.id);
        const isInvalid = !!error;
        const borderStyle = isInvalid 
          ? '4px solid red'
          : isConnected ? `4px solid ${color.hex}` : `2px dashed ${color.hex}`;
        return (
          <div
            key={handle.id}
            className="absolute left-0 z-10"
            style={{ top: topPosition, transform: 'translateX(-100%)' }}
          >
              <Handle
                id={handle.id}
                type="target"
                position={Position.Left}
                tabIndex={0}
                style={{
                  background: 'transparent',
                  border: borderStyle,
                }}
                className={`w-5 h-5 flex items-center justify-center transition-all duration-200 left-[50%]! rounded-none!`}
              />
            <span className={`absolute left-0 -top-5 translate-x-0 group-hover:-translate-x-full 
              group-focus:-translate-x-full group-focus-within:-translate-x-full in-[.selected]:-translate-x-full 
              px-1 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100
                group-focus-within:opacity-100 in-[.selected]:opacity-100 transition-all duration-200 pointer-events-none
                whitespace-nowrap font-medium text-right`}
                style={{ color: isInvalid ? 'red' : color.hex }}>
              {handle.label || handle.dataTypes.join(' | ')}{handle.required && '*'}
              {isInvalid && ` (${error.error})`}
            </span>
          </div>
        );
      })}

      <div className="px-2 py-2 h-[calc(100%-1rem)]">
        <div className='header-section flex justify-between items-center mb-3 px-1'>
          <div className="text-xs font-semibold text-node-title">
            {node?.name} {props.id}
          </div>
          <NodeMenu {...props} />
        </div>
        <div className='nodrag nopan pointer-events-auto! h-[calc(100%-1rem)]'>
          {props.children}
        </div>
      </div>

      {outputs.map((handle, i) => {
        const actualType = getActualType(ownResult, handle.id);
        const primaryType = handle.dataTypes.length > 1 ? 'Any' : handle.dataTypes[0] || 'Any';
        const displayType = actualType ?? primaryType;
        const color = getColorForType(displayType);
        // Calculate dynamic top position
        const topPosition = `${(i + 1) * (30) + 20}px`;
        const isConnected = edges.some(edge => edge.source === id && edge.sourceHandle === handle.id);

        return (
          <div
            key={handle.id}
            className="absolute right-0 z-10"
            style={{ top: topPosition, }}
          >
              <Handle
                id={handle.id}
                type="source"
                position={Position.Right}
                tabIndex={0}
                style={{
                  background: 'transparent',
                  border: isConnected ? `4px solid ${color.hex}` : `2px dashed ${color.hex}`,
                }}
                className={`w-5 h-5 flex items-center justify-center transition-all duration-200 rounded-none! right-[50%]!`}
              />
            <span className={`
                absolute right-0 -top-5 translate-x-0 group-hover:translate-x-full
                group-focus:translate-x-full group-focus-within:translate-x-full in-[.selected]:translate-x-full
                px-1 py-1 text-xs opacity-0 group-hover:opacity-100
                group-focus:opacity-100 group-focus-within:opacity-100 in-[.selected]:opacity-100
                transition-all duration-200 pointer-events-none whitespace-nowrap font-medium text-left`}
                style={{ color: color.hex }}>
              {handle.label || handle.dataTypes.join(' | ')}
            </span>
          </div>
        );
      })}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';

const CustomConnectionLine = memo(({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode,
  fromHandle,
}: ConnectionLineComponentProps<Node>): JSX.Element => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  const handle = useAppSelector(makeSelectHandleById(fromHandle.id!));
  const { result } = useNodeResult(fromNode.id);

  if (!handle) {
    return <></>;
  }

  const primaryType = handle.dataTypes.length > 1 ? 'Any' : handle.dataTypes[0] || 'Any';
  const actualType = handle.type === 'Output' ? getActualType(result, fromHandle.id!) : null;
  const displayType = actualType ?? primaryType;
  const color = getColorForType(displayType).hex;

  return (
    <g>
      <path
        fill="none"
        stroke={color}
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
});

interface CustomEdgeProps extends EdgeProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  sourceHandle: string;
  targetHandle: string;
}

const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source,
}: CustomEdgeProps): JSX.Element => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edge = useAppSelector(makeSelectEdgeById(id));

  const sourceHandle = useAppSelector(makeSelectHandleById(edge?.sourceHandleId))
  const targetHandle = useAppSelector(makeSelectHandleById(edge?.targetHandleId))
  const { result } = useNodeResult(source);

  if (!sourceHandle || !targetHandle) {
    return <g></g>;
  }

  const sourcePrimary = sourceHandle.dataTypes.length > 1 ? 'Any' : sourceHandle.dataTypes[0] || 'Any';
  const targetPrimary = targetHandle.dataTypes.length > 1 ? 'Any' : targetHandle.dataTypes[0] || 'Any';
  const actualType = getActualType(result, sourceHandle.id);
  const sourceDisplay = actualType ?? sourcePrimary;
  const targetDisplay = actualType ?? targetPrimary;
  const sourceColor = getColorForType(sourceDisplay).hex;
  const targetColor = getColorForType(targetDisplay).hex;
  const gradientId = `gradient-${id}`;
  console.log({sourceColor, targetColor});
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1={sourceX} y1={sourceY} x2={targetX} y2={targetY} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: 3,
        }}
        className="react-flow__edge-path fill-none hover:stroke-[15px]! hover:opacity-80"
        d={edgePath}
        stroke={`url(#${gradientId})`}
        markerEnd={markerEnd}
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;-20"
          dur="12s"
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>
    </g>
  );
});

export { BaseNode, CustomEdge, CustomConnectionLine };