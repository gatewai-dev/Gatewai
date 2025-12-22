import { memo, type JSX, type ReactNode } from 'react';
import { Handle, Position, useReactFlow, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { ClientNodeData } from '../ctx/node-types';

// Updated color mapping for DataType enum from schema with actual hex colors
const dataTypeColors: Record<string, { bg: string; stroke: string; hex: string; text: string }> = {
  'Text': { bg: 'bg-blue-500', stroke: 'stroke-blue-500', hex: '#3b82f6', text: 'text-blue-500' },
  'Number': { bg: 'bg-green-500', stroke: 'stroke-green-500', hex: '#22c55e', text: 'text-green-500' },
  'Boolean': { bg: 'bg-yellow-500', stroke: 'stroke-yellow-500', hex: '#eab308', text: 'text-yellow-500' },
  'Image': { bg: 'bg-purple-500', stroke: 'stroke-purple-500', hex: '#a855f7', text: 'text-purple-500' },
  'Video': { bg: 'bg-red-500', stroke: 'stroke-red-500', hex: '#ef4444', text: 'text-red-500' },
  'Audio': { bg: 'bg-orange-500', stroke: 'stroke-orange-500', hex: '#f97316', text: 'text-orange-500' },
  'File': { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' },
};

const getColorForType = (type: string) => {
  return dataTypeColors[type] || { bg: 'bg-gray-500', stroke: 'stroke-gray-500', hex: '#6b7280', text: 'text-gray-500' };
};

const BaseNode = memo((props: ClientNodeData & {
  children?: ReactNode;
}) => {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const nodeId = props.id;
  // Handle optional inputTypes and outputTypes from template
  const inputTypes = props.data?.template?.inputTypes ?? [];
  const outputTypes = props.data?.template?.outputTypes ?? [];

  const fixedInputCount = inputTypes.length;
  const fixedOutputCount = outputTypes.length;
  const variableInputs = props.data?.variableInputs ?? false;
  const variableOutputs = props.data?.variableOutputs ?? false;

  const inputEdges = edges.filter((edge) => edge.target === nodeId);
  const outputEdges = edges.filter((edge) => edge.source === nodeId);

  const numInputs = variableInputs ? Math.max(fixedInputCount, inputEdges.length + 1) : fixedInputCount;
  const numOutputs = variableOutputs ? Math.max(fixedOutputCount, outputEdges.length + 1) : fixedOutputCount;

  const getInputTextColor = (i: number) => {
    if (inputTypes.length === 0) return getColorForType('File').text;
    const type = (i < inputTypes.length) ? inputTypes[i].inputType : inputTypes[inputTypes.length - 1].inputType;
    return getColorForType(type).text;
  };

  const getInputLabel = (i: number) => {
    if (inputTypes.length === 0) return getColorForType('Text').text;
    const label = (i < inputTypes.length) ? inputTypes[i].label : inputTypes[inputTypes.length - 1].label;
    return label;
  };

  const getInputType = (i: number) => {
    if (inputTypes.length === 0) return 'Unknown';
    return (i < inputTypes.length) ? inputTypes[i].inputType : inputTypes[inputTypes.length - 1].inputType;
  };

  const getOutputTextColor = (i: number) => {
    if (outputTypes.length === 0) return getColorForType('File').text;
    const type = (i < outputTypes.length) ? outputTypes[i].outputType : outputTypes[outputTypes.length - 1].outputType;
    return getColorForType(type).text;
  };

  const getOutputType = (i: number) => {
    if (outputTypes.length === 0) return 'Unknown';
    return (i < outputTypes.length) ? outputTypes[i].outputType : outputTypes[outputTypes.length - 1].outputType;
  };

  const getOutputLabel = (i: number) => {
    const label = (i < outputTypes.length) ? outputTypes[i].label : outputTypes[outputTypes.length - 1].label;
    return label;
  };

  const nodeBackgroundColor = 'bg-background';

  return (
    <div
      tabIndex={0}
      className={`relative drag-handle ${nodeBackgroundColor} rounded-lg shadow-md w-full h-full transition-all duration-200 group
        ${props.selected ? 'selected' : ''}`}
    >

      {Array.from({ length: numInputs }).map((_, i) => {
        const inputTop = `${(i + 1) * (30) + 20}px`;
        return (
          <div key={`target-wrapper-${i}`} className="absolute left-0 z-10" style={{ top: inputTop, transform: 'translateX(-50%)' }}>
            <div className={`w-4 h-4 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200`}>
              <Handle
                key={`target-${i}`}
                id={`target-${i}`}
                type="target"
                position={Position.Left}
                tabIndex={0}
                style={{ 
                  background: getColorForType(getInputType(i)).hex,
                  border: '2px solid white',
                }}
                className={`w-3 h-3 rounded-full left-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
              />
            </div>
            <span className={`absolute left-0 top-[-20px] translate-x-[-100%] ${getInputTextColor(i)} px-1 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 in-[.selected]:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-medium text-right`}>
              {getInputLabel(i)}
            </span>
          </div>
        );
      })}

      <div className="p-2 h-[calc(100%-1rem)]">
        <div className='header-section flex justify-between items-center mb-3'>
          <div className="text-sm font-semibold text-node-title">
            {props.type}
          </div>
        </div>
        <div className='nodrag h-[calc(100%-1rem)]'>
          {props.children}
        </div>
      </div>

      {Array.from({ length: numOutputs }).map((_, i) => {
        const outputTop = `${(i + 1) * (30) + 20}px`;
        return (
          <div key={`source-wrapper-${i}`} className="absolute right-0 z-10" style={{ top: outputTop, transform: 'translateX(50%)' }}>
            <div className={`w-4 h-4 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200`}>
              <Handle
                key={`source-${i}`}
                id={`source-${i}`}
                type="source"
                position={Position.Right}
                tabIndex={0}
                style={{ 
                  background: getColorForType(getOutputType(i)).hex,
                  border: '2px solid white',
                }}
                className={`w-3 h-3 rounded-full right-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
              />
            </div>
            <span className={`absolute right-0 top-[-20px] translate-x-[100%] ${getOutputTextColor(i)} px-1 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 [.selected_&]:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-medium text-left`}>
              {getOutputLabel(i)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';

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

const CustomEdge = ({
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

  // Get the hex color based on dataType
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
      className="react-flow__edge-path fill-none transition-all duration-200 hover:!stroke-[5px] hover:opacity-80"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
};

// Custom connection line component for drag preview
interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromPosition: Position;
  toPosition: Position;
  connectionStatus: string | null;
  fromNode?: any;
  fromHandle?: any;
}

const CustomConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode,
  fromHandle,
}: ConnectionLineProps): JSX.Element => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  // Extract data type from the source node's output types
  let dataType = 'File';
  
  if (fromNode && fromHandle?.id) {
    const handleIndex = parseInt(fromHandle.id.split('-')[1] || '0');
    const outputTypes = fromNode.data?.data?.outputTypes || [];
    
    if (outputTypes.length > 0) {
      // Get the type from the handle index, or use the last one for variable outputs
      const typeIndex = handleIndex < outputTypes.length ? handleIndex : outputTypes.length - 1;
      dataType = outputTypes[typeIndex]?.outputType;
      if (!dataType) {
        throw new Error("Output type not found for the given handle index");
      }
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
};

export { BaseNode, CustomEdge, CustomConnectionLine };