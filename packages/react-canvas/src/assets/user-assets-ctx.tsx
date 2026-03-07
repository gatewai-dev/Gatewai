import type {
	UserAssetsListRPC,
	UserAssetsListRPCParams,
} from "@gatewai/react-store";
import { useGetUserAssetsInfiniteQuery } from "@gatewai/react-store";
import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
	useContext,
	useMemo,
	useState,
} from "react";

interface UserAssetsContextType {
	assets: UserAssetsListRPC | undefined;
	isLoading: boolean;
	isError: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	fetchNextPage: () => void;
	queryParams: UserAssetsListRPCParams;
	setQueryParams: Dispatch<SetStateAction<UserAssetsListRPCParams>>;
}

const UserAssetsContext = createContext<UserAssetsContextType | undefined>(
	undefined,
);

const UserAssetsProvider = ({ children }: PropsWithChildren) => {
	const [queryParams, setQueryParams] = useState<UserAssetsListRPCParams>({
		query: {
			pageIndex: 0,
			pageSize: 20,
			q: "",
			type: undefined,
		},
	});

	const {
		data,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useGetUserAssetsInfiniteQuery(queryParams);

	// Flatten the pages for easy consumption
	const assets = useMemo(() => {
		if (!data) return undefined;
		const allAssets = data.pages.flatMap((page) => page.assets);
		const lastPage = data.pages[data.pages.length - 1];
		if (!lastPage) return undefined;

		return {
			...lastPage,
			assets: allAssets,
		};
	}, [data]);

	const value: UserAssetsContextType = {
		assets,
		isLoading,
		isError,
		isFetchingNextPage,
		hasNextPage: !!hasNextPage,
		fetchNextPage,
		setQueryParams,
		queryParams,
	};

	return (
		<UserAssetsContext.Provider value={value}>
			{children}
		</UserAssetsContext.Provider>
	);
};

export function useUserAssets() {
	const ctx = useContext(UserAssetsContext);
	if (!ctx) {
		throw new Error("useUserAssets must be used within a UserAssetsProvider");
	}
	return ctx;
}

export { UserAssetsContext, UserAssetsProvider };
