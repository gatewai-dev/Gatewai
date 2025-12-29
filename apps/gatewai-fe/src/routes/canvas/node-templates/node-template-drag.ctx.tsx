import type { NodeTemplateListRPC } from "@/rpc/types";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useState,
} from "react";

type NodeTemplateEntity = NodeTemplateListRPC[number]
interface NodeTemplateDnDContextType {
	template: NodeTemplateEntity | undefined;
	setTemplate: (template: NodeTemplateEntity | undefined) => void;
}

const NodeTemplateDnDContext = createContext<
	NodeTemplateDnDContextType | undefined
>(undefined);

const NodeTemplateDnDProvider = ({ children }: PropsWithChildren) => {
	const [template, setTemplate] = useState<NodeTemplateEntity | undefined>();

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
