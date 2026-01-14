import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
	useContext,
	useState,
} from "react";
import type { UserAssetsListRPC, UserAssetsListRPCParams } from "@/rpc/types";
import { useGetUserAssetsQuery } from "@/store/assets";

interface UserAssetsContextType {
	assets: UserAssetsListRPC | undefined;
	isLoading: boolean;
	isError: boolean;
	queryParams: UserAssetsListRPCParams;
	setQueryParams: Dispatch<SetStateAction<UserAssetsListRPCParams>>;
}

const UserAssetsContext = createContext<UserAssetsContextType | undefined>(
	undefined,
);

const UserAssetsProvider = ({ children }: PropsWithChildren) => {
	const [queryParams, setQueryParams] = useState<UserAssetsListRPCParams>({
		query: {
			pageIndex: "0",
			pageSize: "50",
			q: "",
			type: undefined,
		},
	});

	const { data, isLoading, isError } = useGetUserAssetsQuery(queryParams);

	const value: UserAssetsContextType = {
		assets: data,
		isLoading,
		isError,
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
