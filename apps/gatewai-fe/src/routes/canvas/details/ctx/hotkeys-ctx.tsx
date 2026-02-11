import { createContext, type PropsWithChildren } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAppSelector } from "@gatewai/react-store";
import { selectSelectedEdgeIds } from "@gatewai/react-store";
import { selectSelectedNodes } from "@gatewai/react-store";
import { useCanvasCtx } from "./canvas-ctx";

type ShortcutsContextType = null;

const ShortcutsContext = createContext<ShortcutsContextType | undefined>(
	undefined,
);

const ShortcutsProvider = ({ children }: PropsWithChildren) => {
	const selectedNodes = useAppSelector(selectSelectedNodes);
	const selectedEdgeIds = useAppSelector(selectSelectedEdgeIds);
	const { duplicateNodes, onNodesDelete, onEdgesDelete } = useCanvasCtx();

	const selectedNodeIDs = selectedNodes?.map((m) => m.id) ?? [];

	useHotkeys(
		"ctrl+d, meta+d",
		(event) => {
			if (!selectedNodes) {
				return;
			}
			event.preventDefault();
			duplicateNodes(selectedNodeIDs);
		},
		{ enabled: selectedNodeIDs.length > 0, preventDefault: true },
	);

	useHotkeys(
		"backspace, delete",
		(event) => {
			event.preventDefault();
			if (selectedNodeIDs.length > 0) {
				onNodesDelete(selectedNodeIDs);
			}
			if (selectedEdgeIds && selectedEdgeIds?.length > 0) {
				onEdgesDelete(selectedEdgeIds);
			}
		},
		{ preventDefault: true },
		[selectedNodeIDs, selectedEdgeIds],
	);

	return (
		<ShortcutsContext.Provider value={undefined}>
			{children}
		</ShortcutsContext.Provider>
	);
};

export { ShortcutsContext, ShortcutsProvider };
