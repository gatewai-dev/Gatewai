import { createContext, type ReactNode, useContext, useState } from "react";

interface NodePaletteContextType {
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	fromTypes: string[];
	setFromTypes: (t: string[]) => void;
	toTypes: string[];
	setToTypes: (t: string[]) => void;
	isCollapsed: boolean;
	setIsCollapsed: (b: boolean) => void;
}

const NodePaletteContext = createContext<NodePaletteContextType | undefined>(
	undefined,
);

export function NodePaletteProvider({ children }: { children: ReactNode }) {
	const [searchQuery, setSearchQuery] = useState("");
	const [fromTypes, setFromTypes] = useState<string[]>([]);
	const [toTypes, setToTypes] = useState<string[]>([]);
	const [isCollapsed, setIsCollapsed] = useState(false);

	return (
		<NodePaletteContext.Provider
			value={{
				searchQuery,
				setSearchQuery,
				fromTypes,
				setFromTypes,
				toTypes,
				setToTypes,
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
	if (!context) throw new Error("useNodePalette must be inside provider");
	return context;
};
