import { createContext, type ReactNode, useContext, useState } from "react";
import { usePersistentState } from "../../lib/persistent-state";

interface NodePaletteContextType {
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	isCollapsed: boolean;
	setIsCollapsed: (b: boolean) => void;
}

const NodePaletteContext = createContext<NodePaletteContextType | undefined>(
	undefined,
);

export function NodePaletteProvider({ children }: { children: ReactNode }) {
	const [searchQuery, setSearchQuery] = useState("");
	const [isCollapsed, setIsCollapsed] = usePersistentState(
		"node-palette-collapsed",
		false,
	);

	return (
		<NodePaletteContext.Provider
			value={{
				searchQuery,
				setSearchQuery,
				isCollapsed,
				setIsCollapsed,
			}}
		>
			{children}
		</NodePaletteContext.Provider>
	);
}

export const useNodePalette = () => {
	const context = useContext(NodePaletteContext);
	if (!context)
		throw new Error("useNodePalette must be used within a NodePaletteProvider");
	return context;
};
