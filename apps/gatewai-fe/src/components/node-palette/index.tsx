// Node Palette Component (renders templates with icons for drag-drop)
// Use this in your sidebar or toolbox component
// Assumes you have lucide-react installed for icons

import { useCanvasCtx } from './CanvasProvider'; // Adjust path
import { Brush, Cube, Download, Eye, File, FileText, GitBranch, Group, Layers, Maximize, MessageSquare, Music, Spider, ToggleLeft, User, Video as VideoIcon, Blur as BlurIcon, Mask as MaskIcon } from 'lucide-react';
import type { DragEvent } from 'react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Prompt: MessageSquare,
  Preview: Eye,
  Video: VideoIcon,
  Audio: Music,
  File: File,
  Export: Download,
  Toggle: ToggleLeft,
  Crawler: Spider,
  Resize: Maximize,
  Group: Group,
  Agent: User,
  ThreeD: Cube,
  Mask: MaskIcon,
  Painter: Brush,
  Blur: BlurIcon,
  Compositor: Layers,
  Describer: FileText,
  Router: GitBranch,
};

export function NodePalette() {
  const { templates, templatesLoading } = useCanvasCtx();

  const onDragStart = (event: DragEvent<HTMLDivElement>, template: any) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: template.type,
      templateId: template.id,
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (templatesLoading) {
    return <div>Loading templates...</div>;
  }

  return (
    <div className="node-palette grid grid-cols-2 gap-4 p-4 bg-gray-100">
      {templates.map((template) => {
        const Icon = iconMap[template.type] || File; // Fallback to File icon
        return (
          <div
            key={template.id}
            className="node-item flex flex-col items-center p-2 bg-white border border-gray-300 rounded cursor-grab hover:bg-gray-50"
            draggable
            onDragStart={(e) => onDragStart(e, template)}
          >
            <Icon className="w-8 h-8 mb-2 text-blue-500" />
            <span className="text-sm font-medium">{template.displayName}</span>
            {template.description && <span className="text-xs text-gray-500">{template.description}</span>}
          </div>
        );
      })}
    </div>
  );
}