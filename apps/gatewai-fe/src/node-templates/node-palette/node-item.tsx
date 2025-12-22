// src/node-palette/NodeItem.tsx
import type { DragEvent } from 'react';
import type { NodeTemplate } from '@gatewai/types';
import { useNodeTemplateDnD } from '@/node-templates/node-template-drag.ctx';
import { iconMap } from './icon-map';

export function NodeItem({ template }: { template: NodeTemplate }) {
  const { setTemplate } = useNodeTemplateDnD();

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    setTemplate(template);
    event.dataTransfer.effectAllowed = 'move';
  };

  const Icon = iconMap[template.type] || iconMap.File;

  return (
    <div
      key={template.id}
      className="node-item flex flex-col items-center p-2 bg-white border border-gray-300 rounded cursor-grab hover:bg-gray-50"
      draggable
      onDragStart={onDragStart}
    >
      <Icon className="w-8 h-8 mb-2 text-blue-500" />
      <span className="text-sm font-medium">{template.displayName}</span>
      {template.description && <span className="text-xs text-gray-500">{template.description}</span>}
    </div>
  );
}