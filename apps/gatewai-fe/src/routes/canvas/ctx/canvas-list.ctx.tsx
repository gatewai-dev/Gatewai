import {
	createContext,
	useContext,
	useState,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
} from "react";
import type { CanvasListRPC } from "@/rpc/types";
import {
	useCreateCanvasMutation,
	useGetCanvasListQuery,
} from "@/store/canvas-list";

interface CanvasContextType {
	canvasList: CanvasListRPC | undefined;
	isError: boolean;
	isLoading: boolean;
	searchQuery: string | undefined;
	setSearchQuery: Dispatch<SetStateAction<string | undefined>>;
	createCanvas: (
		name: string,
	) => ReturnType<ReturnType<typeof useCreateCanvasMutation>[0]>;
	isCreating: boolean;
}

const CanvasListContext = createContext<CanvasContextType | undefined>(
	undefined,
);

const CanvasListProvider = ({ children }: PropsWithChildren) => {
	const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
	const { data, isLoading, isError } = useGetCanvasListQuery({});
	const [mutate, { isLoading: isCreating }] = useCreateCanvasMutation();

	const value = {
		canvasList: data,
		isError,
		isLoading,
		searchQuery,
		setSearchQuery,
		createCanvas: mutate,
		isCreating,
	};

	return (
		<CanvasListContext.Provider value={value}>
			{children}
		</CanvasListContext.Provider>
	);
};

export function useCanvasListCtx() {
	const ctx = useContext(CanvasListContext);
	if (!ctx) {
		throw new Error("useCanvasListCtx should used inside CanvasListProvider");
	}
	return ctx;
}

export { CanvasListContext, CanvasListProvider };
