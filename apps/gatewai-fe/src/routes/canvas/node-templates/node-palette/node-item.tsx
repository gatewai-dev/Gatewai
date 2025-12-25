import { useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { iconMap } from './icon-map';
import { useDraggable } from '@neodrag/react';
import type { XYPosition } from '@xyflow/react';
import { useCanvasCtx } from '@/routes/canvas/details/ctx/canvas-ctx';
import type { NodeTemplateListItemRPC } from '@/rpc/types';

export function NodeItem({ template }: { template: NodeTemplateListItemRPC }) {
  const { rfInstance, createNewNode } = useCanvasCtx();
  const draggableRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<XYPosition>({ x: 0, y: 0 });

  useDraggable(draggableRef, {
    position: position,
    onDrag: ({ offsetX, offsetY }) => {
      // Calculate position relative to the viewport
      setPosition({
        x: offsetX,
        y: offsetY,
      });
    },
    onDragEnd: ({ event }) => {
      setPosition({ x: 0, y: 0 });
      const flow = document.querySelector('.react-flow-container');
      const flowRect = flow?.getBoundingClientRect();
      const screenPosition = { x: event.clientX, y: event.clientY };
      const isInFlow =
        flowRect &&
        screenPosition.x >= flowRect.left &&
        screenPosition.x <= flowRect.right &&
        screenPosition.y >= flowRect.top &&
        screenPosition.y <= flowRect.bottom;

      // Create a new node and add it to the flow
      if (isInFlow) {
        const position = rfInstance.current?.screenToFlowPosition(screenPosition);

        createNewNode(template, position || { x: 0, y: 0 });
      }
    },
  });

  const Icon = iconMap[template.type] || iconMap.File;

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            key={template.id}
            className="node-item flex flex-col items-center p-2 border border-gray-600 rounded cursor-grab"
            ref={draggableRef}
          >
            <Icon className="w-5 h-5 mb-2 text-gray-400" />
            <span className="text-sm font-medium">{template.displayName}</span>
          </div>
        </TooltipTrigger>
        {template.description && (
          <TooltipContent>
            <p>{template.description}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}