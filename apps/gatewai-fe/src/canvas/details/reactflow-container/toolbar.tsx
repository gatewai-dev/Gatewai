import { Pointer, Hand, Undo2, Redo2 } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useCanvasCtx } from '../ctx/canvas-ctx';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';

function Toolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo } = useCanvasCtx();
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoomPercentage = Math.round(zoom * 100) + '%';

  return (
    <Menubar className="border-0 bg-background px-2 py-1 rounded-md shadow-md">
      <ToggleGroup
        type="single"
        value={tool}
        onValueChange={(value) => value && setTool(value as "select" | 'pan')}
        className="gap-1"
      >
        <ToggleGroupItem value="select" aria-label="Select tool" size="sm">
          <Pointer size={18} />
        </ToggleGroupItem>
        <ToggleGroupItem value="pan" aria-label="Pan tool" size="sm">
          <Hand size={18} />
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="w-px h-6 bg-border mx-2" />

      <div className="flex gap-1">
        <Toggle
          pressed={false}
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          size="sm"
        >
          <Undo2 size={18} />
        </Toggle>
        <Toggle
          pressed={false}
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          size="sm"
        >
          <Redo2 size={18} />
        </Toggle>
      </div>

      <div className="flex-1" />

      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1 cursor-pointer">
          {zoomPercentage} <span className="text-muted-foreground ml-1">▼</span>
        </MenubarTrigger>
        <MenubarContent align="end">
          <MenubarItem onClick={() => zoomIn()}>
            Zoom in <span className="ml-auto text-muted-foreground">Ctrl +</span>
          </MenubarItem>
          <MenubarItem onClick={() => zoomOut()}>
            Zoom out <span className="ml-auto text-muted-foreground">Ctrl -</span>
          </MenubarItem>
          <MenubarItem onClick={() => zoomTo(1)}>
            Zoom to 100% <span className="ml-auto text-muted-foreground">Ctrl 0</span>
          </MenubarItem>
          <MenubarItem onClick={() => fitView()}>
            Zoom to fit <span className="ml-auto text-muted-foreground">Ctrl 1</span>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

export { Toolbar };