import { memo, useMemo, type JSX, type ReactNode } from 'react';
import { Handle, Position, getBezierPath, type EdgeProps, type NodeProps, type Node, type ConnectionLineComponentProps, useEdges, BaseEdge, getSmoothStepPath } from '@xyflow/react';
import type { CanvasDetailsNode } from '@/rpc/types';
import { useAppSelector } from '@/store';
import { makeSelectHandleById, makeSelectHandleByNodeId } from '@/store/handles';
import { dataTypeColors } from '@/config';
import { NodeMenu } from './node-menu';
import { makeSelectEdgeById } from '@/store/edges';
import { useNodeInputValidation } from './hooks/use-node-input-validation';


const getColorForType = (type: string) => {
  return dataTypeColors[type] || { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' };
};


const BaseNode = memo((props: NodeProps<Node<CanvasDetailsNode>> & {
  children?: ReactNode;
}) => {
  const { selected, type, id } = props;
  const handles = useAppSelector(makeSelectHandleByNodeId(id));
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
  const validationErrors = useNodeInputValidation(id);
  console.log({validationErrors})
  const edges = useEdges();

  const nodeBackgroundColor = 'bg-background';

  return (
    <div
      tabIndex={0}
      className={`relative drag-handle ${nodeBackgroundColor} rounded-2xl shadow-md w-full h-full transition-all duration-200 group
        ${selected ? 'selected' : ''}`}
    >
      {inputs.map((handle, i) => {
        const color = getColorForType(handle.dataType);
        const topPosition = `${(i + 1) * (30) + 20}px`;
        const isConnected = edges.some(edge => edge.target === id && edge.targetHandle === handle.id);
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
              {handle.label || handle.dataType} {handle.required && '*'}
              {isInvalid && ` (${error.error})`}
            </span>
          </div>
        );
      })}

      <div className="px-2 py-2 h-[calc(100%-1rem)]">
        <div className='header-section flex justify-between items-center mb-3 px-1'>
          <div className="text-xs font-semibold text-node-title">
            {type}
          </div>
          <NodeMenu {...props} />
        </div>
        <div className='nodrag h-[calc(100%-1rem)]'>
          {props.children}
        </div>
      </div>

      {outputs.map((handle, i) => {
        const color = getColorForType(handle.dataType);
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
              {handle.label || handle.dataType}
            </span>
          </div>
        );
      })}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';

const PARTICLE_COUNT = 1;
const ANIMATE_DURATION = 6;

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

  let dataType = null;
  const handle = useAppSelector(makeSelectHandleById(fromHandle.id!));
  if (!fromHandle.id || !handle) {
    return <></>;
  }
  // Logic updated to find the specific handle in the handles array
  if (fromNode?.data?.handles && fromHandle?.id) {
    if (handle) {
      dataType = handle.dataType;
    }
  }

  const color = getColorForType(dataType ?? 'Any').hex;

  return (
    <g>
      <path
        fill="none"
        stroke={color}
        strokeWidth={3}
        d={edgePath}
      />
      {[...Array(PARTICLE_COUNT)].map((_, i) => (
        <ellipse
          key={`particle-${i}`}
          r="5"
          rx="5"
          ry="1.2"
          fill={color}
        >
          <animateMotion
            begin={`${i * (ANIMATE_DURATION / PARTICLE_COUNT)}s`}
            dur={`${ANIMATE_DURATION}s`}
            repeatCount="indefinite"
            rotate="auto"
            path={edgePath}
            calcMode="spline"
            keySplines="0.42, 0, 0.58, 1.0"
          />
        </ellipse>
      ))}
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

  const sourceHandle = useAppSelector(makeSelectHandleById(edge?.sourceHandleId ?? undefined))
  const targetHandle = useAppSelector(makeSelectHandleById(edge?.targetHandleId ?? undefined))

  const sourceDataType = sourceHandle?.dataType || 'Any';
  const targetDataType = targetHandle?.dataType || 'Any';
  const sourceColor = getColorForType(sourceDataType).hex;
  const targetColor = getColorForType(targetDataType).hex;
  const gradientId = `gradient-${id}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1={sourceX} y1={sourceY} x2={targetX} y2={targetY} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        style={{
          ...style,
          stroke: `url(#${gradientId})`,
          strokeWidth: 3,
        }}
        className="react-flow__edge-path fill-none hover:stroke-[5px]! hover:opacity-80"
        path={edgePath}
        markerEnd={markerEnd}
      />
      {[...Array(PARTICLE_COUNT)].map((_, i) => (
        <ellipse
          key={`particle-${i}`}
          rx="5"
          ry="1.2"
          fill={sourceColor}
        >
          <animateMotion
            begin={`${i * (ANIMATE_DURATION / PARTICLE_COUNT)}s`}
            dur={`${ANIMATE_DURATION}s`}
            repeatCount="indefinite"
            rotate="auto"
            path={edgePath}
            calcMode="spline"
            keySplines="0.42, 0, 0.58, 1.0"
          />
        </ellipse>
      ))}
    </g>
  );
});

export { BaseNode, CustomEdge, CustomConnectionLine };