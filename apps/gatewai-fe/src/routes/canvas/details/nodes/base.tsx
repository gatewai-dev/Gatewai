import { memo, useMemo, type JSX, type ReactNode } from 'react';
import { Handle, Position, getBezierPath, type EdgeProps, type NodeProps, type Node, type ConnectionLineComponentProps } from '@xyflow/react';
import type { CanvasDetailsNode } from '@/rpc/types';


const dataTypeColors: Record<string, { bg: string; stroke: string; hex: string; text: string }> = {
  'Text': { bg: 'bg-blue-500', stroke: 'stroke-blue-500', hex: '#3b82f6', text: 'text-blue-500' },
  'Number': { bg: 'bg-green-500', stroke: 'stroke-green-500', hex: '#22c55e', text: 'text-green-500' },
  'Boolean': { bg: 'bg-yellow-500', stroke: 'stroke-yellow-500', hex: '#eab308', text: 'text-yellow-500' },
  'Image': { bg: 'bg-purple-500', stroke: 'stroke-purple-500', hex: '#a855f7', text: 'text-purple-500' },
  'Video': { bg: 'bg-red-500', stroke: 'stroke-red-500', hex: '#ef4444', text: 'text-red-500' },
  'Audio': { bg: 'bg-orange-500', stroke: 'stroke-orange-500', hex: '#f97316', text: 'text-orange-500' },
  'File': { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' },
  'Mask': { bg: 'bg-pink-500', stroke: 'stroke-pink-500', hex: '#ec4899', text: 'text-pink-500' },
};

const getColorForType = (type: string) => {
  return dataTypeColors[type] || { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' };
};

// --- Components ---

const BaseNode = memo((props: NodeProps<Node<CanvasDetailsNode>> & {
  children?: ReactNode;
}) => {
  const { data, selected, type } = props;
  console.log({props})
  // 1. Separate and Sort Handles
  // We use useMemo to avoid re-sorting on every render unless data.handles changes
  const { inputs, outputs } = useMemo(() => {
    const allHandles = data.handles || [];
    
    // Sort by 'order' property from DB
    const sorted = [...allHandles].sort((a, b) => a.order - b.order);
    
    return {
      inputs: sorted.filter(h => h.type === 'Input'),
      outputs: sorted.filter(h => h.type === 'Output')
    };
  }, [data.handles]);

  const nodeBackgroundColor = 'bg-background';

  return (
    <div
      tabIndex={0}
      className={`relative drag-handle ${nodeBackgroundColor} rounded-lg shadow-md w-full h-full transition-all duration-200 group
        ${selected ? 'selected' : ''}`}
    >
      {/* --- INPUT HANDLES --- */}
      {inputs.map((handle, i) => {
        const color = getColorForType(handle.dataType);
        // Calculate dynamic top position
        const topPosition = `${(i + 1) * (30) + 20}px`;
        
        return (
          <div 
            key={handle.id} 
            className="absolute left-0 z-10" 
            style={{ top: topPosition, transform: 'translateX(-50%)' }}
          >
            <div className={`w-4 h-4 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200`}>
              <Handle
                id={handle.id} // CRITICAL: This matches the DB Handle ID
                type="target"
                position={Position.Left}
                tabIndex={0}
                style={{ 
                  background: color.hex,
                  border: '2px solid white',
                }}
                className={`w-3 h-3 rounded-full left-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
              />
            </div>
            {/* Tooltip / Label */}
            <span className={`absolute left-0 -top-5 translate-x-0 group-hover:-translate-x-full 
              group-focus:-translate-x-full group-focus-within:-translate-x-full in-[.selected]:-translate-x-full 
              ${color.text} px-1 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100
               group-focus-within:opacity-100 in-[.selected]:opacity-100 transition-all duration-200 pointer-events-none
                whitespace-nowrap font-medium text-right`}>
              {handle.label || handle.dataType}
            </span>
          </div>
        );
      })}

      {/* --- CONTENT --- */}
      <div className="p-2 h-[calc(100%-1rem)]">
        <div className='header-section flex justify-between items-center mb-3'>
          <div className="text-sm font-semibold text-node-title">
            {type}
          </div>
        </div>
        <div className='nodrag h-[calc(100%-1rem)]'>
          {props.children}
        </div>
      </div>

      {/* --- OUTPUT HANDLES --- */}
      {outputs.map((handle, i) => {
        const color = getColorForType(handle.dataType);
        // Calculate dynamic top position
        const topPosition = `${(i + 1) * (30) + 20}px`;

        return (
          <div 
            key={handle.id} 
            className="absolute right-0 z-10" 
            style={{ top: topPosition, transform: 'translateX(50%)' }}
          >
            <div className={`w-4 h-4 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200`}>
              <Handle
                id={handle.id} // CRITICAL: This matches the DB Handle ID
                type="source"
                position={Position.Right}
                tabIndex={0}
                style={{ 
                  background: color.hex,
                  border: '2px solid white',
                }}
                className={`w-3 h-3 rounded-full right-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
              />
            </div>
            {/* Tooltip / Label */}
            <span className={`
                absolute right-0 -top-5 translate-x-0 group-hover:translate-x-full 
                group-focus:translate-x-full group-focus-within:translate-x-full in-[.selected]:translate-x-full
                 ${color.text} px-1 py-1 text-xs opacity-0 group-hover:opacity-100 
                 group-focus:opacity-100 group-focus-within:opacity-100 in-[.selected]:opacity-100 
                 transition-all duration-200 pointer-events-none whitespace-nowrap font-medium text-left`}>
              {handle.label || handle.dataType}
            </span>
          </div>
        );
      })}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';

// --- Connection Line ---

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

  let dataType = 'File';
  const fromDBNode = fromNode.data as CanvasDetailsNode;
  // Logic updated to find the specific handle in the handles array
  if (fromNode?.data?.handles && fromHandle?.id) {
    const handle = fromDBNode.handles.find(h => h.id === fromHandle.id);
    if (handle) {
      dataType = handle.dataType;
    }
  }

  const color = getColorForType(dataType).hex;

  return (
    <g>
      <path
        fill="none"
        stroke={color}
        strokeWidth={3}
        className="animated"
        d={edgePath}
        style={{
          animation: 'dashdraw 0.5s linear infinite',
          strokeDasharray: '5, 5',
        }}
      />
    </g>
  );
});

// --- Edge --- 

interface CustomEdgeProps extends EdgeProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  data?: { dataType?: string };
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

  const dataType = data?.dataType || 'File';
  const color = getColorForType(dataType).hex;

  return (
    <path
      id={id}
      style={{
        ...style,
        stroke: color,
        strokeWidth: 3,
      }}
      className="react-flow__edge-path fill-none transition-all duration-200 hover:stroke-[5px]! hover:opacity-80"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
});

export { BaseNode, CustomEdge, CustomConnectionLine };