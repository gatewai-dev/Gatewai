import { createContext, type PropsWithChildren } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCanvasCtx } from './canvas-ctx';
import { useSelectedEntitiesCtx } from './selected-entity-ctx';

type ShortcutsContextType = {}

const ShortcutsContext = createContext<ShortcutsContextType | undefined>(undefined);

const ShortcutsProvider = ({
  children,
}: PropsWithChildren) => {

  const { selectedNodeIDs } = useSelectedEntitiesCtx();
  const { duplicateNodes, onNodesDelete } = useCanvasCtx();

  useHotkeys('ctrl+d, meta+d', (event) => {
    event.preventDefault();
    duplicateNodes(selectedNodeIDs)
  }, { enabled: selectedNodeIDs.length > 0, preventDefault: true });

  useHotkeys('backspace, delete', (event) => {
    event.preventDefault();
    if (selectedNodeIDs.length > 0) {
      onNodesDelete(selectedNodeIDs);
    }
  }, { enabled: selectedNodeIDs.length > 0 });

  return <ShortcutsContext.Provider value={undefined}>{children}</ShortcutsContext.Provider>;
};

export { ShortcutsContext, ShortcutsProvider };