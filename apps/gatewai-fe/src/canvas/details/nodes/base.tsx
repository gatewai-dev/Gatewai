import { memo, type JSX, type ReactNode } from 'react';
import { Handle, Position, useReactFlow, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { ClientNodeData } from '../ctx/node-types';

// Updated color mapping for split DataType enum
const dataTypeColors: Record<string, string> = {
  'Prompt': 'bg-blue-500',
  'Number': 'bg-green-500',
  'Toggle': 'bg-yellow-500',
  'Image': 'bg-purple-500',
  'Video': 'bg-red-500',
  'Audio': 'bg-orange-500',
  'File': 'bg-gray-500',
};

const BaseNode = memo((props: ClientNodeData & {
  children?: ReactNode;
}) => {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const nodeId = props.id;

  // Handle optional inputTypes and outputTypes from template
  const inputTypes = props.data?.data?.inputTypes ?? [];
  const outputTypes = props.data?.data?.outputTypes ?? [];

  const fixedInputCount = inputTypes.length;
  const fixedOutputCount = outputTypes.length;
  const variableInputs = props.data?.data?.variableInputs ?? false;
  const variableOutputs = props.data?.data?.variableOutputs ?? false;

  const inputEdges = edges.filter((edge) => edge.target === nodeId);
  const outputEdges = edges.filter((edge) => edge.source === nodeId);

  const numInputs = variableInputs ? Math.max(fixedInputCount, inputEdges.length + 1) : fixedInputCount;
  const numOutputs = variableOutputs ? Math.max(fixedOutputCount, outputEdges.length + 1) : fixedOutputCount;

  const getInputColor = (i: number) => {
    if (inputTypes.length === 0) return 'bg-gray-500';
    const type = (i < inputTypes.length) ? inputTypes[i].inputType : inputTypes[inputTypes.length - 1].inputType;
    return dataTypeColors[type] || 'bg-gray-500';
  };

  const getInputTextColor = (i: number) => {
    return getInputColor(i).replace('bg-', 'text-');
  };

  const getInputType = (i: number) => {
    if (inputTypes.length === 0) return 'Unknown';
    return (i < inputTypes.length) ? inputTypes[i].inputType : inputTypes[inputTypes.length - 1].inputType;
  };

  const getOutputColor = (i: number) => {
    if (outputTypes.length === 0) return 'bg-gray-500';
    const type = (i < outputTypes.length) ? outputTypes[i].outputType : outputTypes[outputTypes.length - 1].outputType;
    return dataTypeColors[type] || 'bg-gray-500';
  };

  const getOutputBorderColor = (i: number) => {
    if (outputTypes.length === 0) return 'border-gray-500';
    const type = (i < outputTypes.length) ? outputTypes[i].outputType : outputTypes[outputTypes.length - 1].outputType;
    return dataTypeColors[type].replace('bg-', 'border-') || 'border-gray-500';
  };

  const getOutputTextColor = (i: number) => {
    return getOutputColor(i).replace('bg-', 'text-');
  };

  const getOutputType = (i: number) => {
    if (outputTypes.length === 0) return 'Unknown';
    return (i < outputTypes.length) ? outputTypes[i].outputType : outputTypes[outputTypes.length - 1].outputType;
  };

  const nodeBackgroundColor = 'bg-gray-800';

  return (
    <div
      tabIndex={0}
      className={`relative drag-handle ${nodeBackgroundColor} rounded-lg shadow-md w-full h-full transition-all duration-200 group
        ${props.selected ? 'selected' : ''}`}
    >

      {Array.from({ length: numInputs }).map((_, i) => (
        <div key={`target-wrapper-${i}`} className="absolute left-0 z-10" style={{ top: `${(i + 1) * (100 / (numInputs + 1))}%`, transform: 'translateX(-50%)' }}>
          <div className={`w-6 h-6 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200 border-2 border-gray-700`}>
            <Handle
              key={`target-${i}`}
              id={`target-${i}`}
              type="target"
              position={Position.Left}
              tabIndex={0}
              className={`w-3 h-3 ${getInputColor(i)} border-2 border-white rounded-full left-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
            />
          </div>
          <span className={`absolute left-[-60px] top-1/2 -translate-y-1/2 ${getInputTextColor(i)} px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 [.selected_&]:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-medium`}>
            {getInputType(i)}
          </span>
        </div>
      ))}

      <div className="p-2">
        <div className='header-section flex justify-between items-center mb-3'>
          <div className="text-sm font-semibold text-node-title">
            {props.type}
          </div>
        </div>
        <div className='nodrag'>
          {props.children}
        </div>
      </div>

      {Array.from({ length: numOutputs }).map((_, i) => (
        <div key={`source-wrapper-${i}`} className="absolute right-0 z-10" style={{ top: `${(i + 1) * (100 / (numOutputs + 1))}%`, transform: 'translateX(50%)' }}>
          <div className={`w-6 h-6 ${nodeBackgroundColor} rounded-full flex items-center justify-center transition-all duration-200 border-2 ${getOutputBorderColor(i)}`}>
            <Handle
              key={`source-${i}`}
              id={`source-${i}`}
              type="source"
              position={Position.Right}
              tabIndex={0}
              className={`w-3 h-3 ${getOutputColor(i)} border-2 border-white rounded-full right-[50%]! transition-all duration-200 focus:outline-none hover:scale-125`}
            />
          </div>
          <span className={`absolute right-[-60px] top-1/2 -translate-y-1/2 ${getOutputTextColor(i)} px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 [.selected_&]:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-medium`}>
            {getOutputType(i)}
          </span>
        </div>
      ))}
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
    <path
      id={id}
      style={style}
      className="react-flow__edge-path stroke-[3px] stroke-zinc-300 fill-none transition-all duration-200 hover:stroke-purple-500 hover:stroke-[4px]"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
};

export { BaseNode, CustomEdge };