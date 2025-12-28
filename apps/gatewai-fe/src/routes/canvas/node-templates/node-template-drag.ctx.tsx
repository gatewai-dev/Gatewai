import type { NodeTemplate } from "@gatewai/types";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useState,
} from "react";

interface NodeTemplateDnDContextType {
	template: NodeTemplate | undefined;
	setTemplate: (template: NodeTemplate | undefined) => void;
}

const NodeTemplateDnDContext = createContext<
	NodeTemplateDnDContextType | undefined
>(undefined);

const NodeTemplateDnDProvider = ({ children }: PropsWithChildren) => {
	const [template, setTemplate] = useState<NodeTemplate | undefined>();

	return (
		<NodeTemplateDnDContext.Provider value={{ template, setTemplate }}>
			{children}
		</NodeTemplateDnDContext.Provider>
	);
};

export function useNodeTemplateDnD() {
	const ctx = useContext(NodeTemplateDnDContext);
	if (!ctx) {
		throw new Error(
			"useNodeTemplateDnD should used inside NodeTemplateDnDProvider",
		);
	}
	return ctx;
}

export { NodeTemplateDnDContext, NodeTemplateDnDProvider };
