
import { memo } from 'react';
import { CanvasTasksPanel } from './tasks';
import { CanvasName } from './canvas-name';
import { Separator } from '@/components/ui/separator';
import { CoinsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TopPanel = memo(() => {
  return (
    <div className="border-0 bg-background flex gap-1 rounded-md shadow-md">
        <CanvasName />
        <Separator orientation='vertical' />
        <CanvasTasksPanel />
        <Separator orientation='vertical' />
        <Button variant="link" className='flex gap-1 items-center text-xs'>1000 <CoinsIcon /></Button>
    </div>
  );
})

export { TopPanel };