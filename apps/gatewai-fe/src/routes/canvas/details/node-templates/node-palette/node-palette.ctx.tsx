import React, { createContext, useContext, useRef, useState } from "react";
import { CATEGORY_MAP } from "./category-icon-map";

interface NodePaletteContextType {
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	fromTypes: string[];
	setFromTypes: (t: string[]) => void;
	toTypes: string[];
	setToTypes: (t: string[]) => void;
	isCollapsed: boolean;
	setIsCollapsed: (b: boolean) => void;
	categoryRefs: React.RefObject<
		Record<string, React.RefObject<HTMLDivElement | null>>
	>;
	activeCategory: string;
	setActiveCategory: (cat: string) => void;
}

const NodePaletteContext = createContext<NodePaletteContextType | undefined>(
	undefined,
);

export function NodePaletteProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [fromTypes, setFromTypes] = useState<string[]>([]);
	const [toTypes, setToTypes] = useState<string[]>([]);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const categoryRefs = useRef<
		Record<string, React.RefObject<HTMLDivElement | null>>
	>(
		Object.fromEntries(
			Object.keys(CATEGORY_MAP).map((cat) => [cat, React.createRef()]),
		),
	);
	const [activeCategory, setActiveCategory] = useState(
		Object.keys(CATEGORY_MAP)[0] || "",
	);

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
				categoryRefs,
				activeCategory,
				setActiveCategory,
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
