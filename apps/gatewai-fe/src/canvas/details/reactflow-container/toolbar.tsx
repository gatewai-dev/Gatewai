import { Pointer, Hand, Undo2, Redo2 } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useCanvasCtx } from '../ctx/canvas-ctx';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function Toolbar() {
  const { tool, setTool, undo, redo, canUndo, canRedo } = useCanvasCtx();
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoomPercentage = Math.round(zoom * 100) + '%';

  return (
    <div className="flex items-center bg-black text-white px-4 py-2 rounded-md shadow-md">
      <Button
        variant="ghost"
        onClick={() => setTool('select')}
        className={`p-2 ${tool === 'select' ? 'bg-gray-700' : ''}`}
      >
        <Pointer size={20} />
      </Button>
      <Button
        variant="ghost"
        onClick={() => setTool('pan')}
        className={`p-2 ${tool === 'pan' ? 'bg-gray-700' : ''}`}
      >
        <Hand size={20} />
      </Button>
      <Button
        variant="ghost"
        onClick={undo}
        disabled={!canUndo}
        className="p-2 disabled:opacity-50"
      >
        <Undo2 size={20} />
      </Button>
      <Button
        variant="ghost"
        onClick={redo}
        disabled={!canRedo}
        className="p-2 disabled:opacity-50"
      >
        <Redo2 size={20} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger className="ml-auto">
          <div className="px-2 cursor-pointer">
            {zoomPercentage} <span className="text-gray-400">▼</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => zoomIn()}>
            Zoom in <span className="ml-auto text-gray-500">Ctrl +</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomOut()}>
            Zoom out <span className="ml-auto text-gray-500">Ctrl -</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomTo(1)}>
            Zoom to 100% <span className="ml-auto text-gray-500">Ctrl 0</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fitView()}>
            Zoom to fit <span className="ml-auto text-gray-500">Ctrl 1</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { Toolbar };