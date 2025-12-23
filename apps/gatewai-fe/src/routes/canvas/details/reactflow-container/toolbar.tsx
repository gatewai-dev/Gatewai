import { Pointer, Hand, Undo2, Redo2, MousePointer2, ChevronDown } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useHotkeys } from 'react-hotkeys-hook';
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
import { useZoomHotkeys } from './use-zoom-hotkeys';

function Toolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo } = useCanvasCtx();
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoomPercentage = Math.round(zoom * 100) + '%';


  // Tool selection hotkeys
  useHotkeys('v', () => setTool('select'), [setTool]);
  useHotkeys('h', () => setTool('pan'), [setTool]);

  // Undo/Redo hotkeys
  useHotkeys('ctrl+z, meta+z', () => {
    if (canUndo) undo();
  }, [canUndo, undo]);

  useHotkeys('ctrl+shift+z, meta+shift+z, ctrl+y, meta+y', () => {
    if (canRedo) redo();
  }, [canRedo, redo]);

  useZoomHotkeys();

  return (
    <Menubar className="border-0 bg-background px-2 py-1 rounded-md shadow-md">
      <div className="flex gap-1">
        <Toggle
          pressed={false}
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo (Ctrl+Z)"
          size="sm"
        >
          <Undo2 size={18} />
        </Toggle>
        <Toggle
          pressed={false}
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo (Ctrl+Shift+Z)"
          size="sm"
        >
          <Redo2 size={18} />
        </Toggle>
      </div>

      <MenubarMenu>
        <MenubarTrigger className="px-3 py-1 cursor-pointer text-xs">
          {zoomPercentage} <ChevronDown className='w-5' />
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