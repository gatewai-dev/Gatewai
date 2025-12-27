// src/node-palette/iconMap.ts
import { Brush, Cuboid, Download, Eye, File, FileText, GitBranch, ImageMinus, ImageUp, Layers, MarsStroke, Maximize, MessageSquare, Monitor, ToggleLeft, User } from 'lucide-react';

export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Text: MessageSquare,
  Preview: Eye,
  File: File,
  Export: Download,
  Toggle: ToggleLeft,
  Crawler: Monitor,
  Resize: Maximize,
  Agent: User,
  ThreeD: Cuboid,
  Mask: ImageUp,
  Painter: Brush,
  Blur: ImageMinus,
  Compositor: Layers,
  Describer: FileText,
  Router: GitBranch,
  // Add fallbacks or additional mappings as needed for other NodeTypes
  Note: FileText,
  Number: MarsStroke,
  ImageGen: ImageUp,
  LLM: MessageSquare,
};