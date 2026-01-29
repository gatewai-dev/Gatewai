import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
	useContext,
	useEffect,
	useState,
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
	searchQuery: string;
	setSearchQuery: Dispatch<SetStateAction<string>>;
	createCanvas: (
		name: string,
	) => ReturnType<ReturnType<typeof useCreateCanvasMutation>[0]>;
	isCreating: boolean;
}

const CanvasListContext = createContext<CanvasContextType | undefined>(
	undefined,
);

export const CanvasListProvider = ({ children }: PropsWithChildren) => {
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch all canvases - no server-side filtering
	const { data, isLoading, isError } = useGetCanvasListQuery({
		query: {
			q: searchQuery,
		},
	});
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
	if (!ctx)
		throw new Error("useCanvasListCtx must be used within CanvasListProvider");
	return ctx;
}
