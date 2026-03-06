import { getEnv } from "@gatewai/core/browser";
import { useGetBalanceQuery } from "@gatewai/react-store";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	GatewaiIcon,
	SparklesIcon,
} from "@gatewai/ui-kit";
import { LayoutGrid, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { ApiKeysSettings } from "./ApiKeysSettings";
import { SubscriptionDialog } from "./SubscriptionDialog";

const enablePricing = getEnv("VITE_ENABLE_PRICING");

export function UserMenu() {
	const nav = useNavigate();
	const { data: balance } = useGetBalanceQuery(undefined, {
		pollingInterval: 30_000,
	});
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);

	return (
		<>
			<ApiKeysSettings open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
			{enablePricing && (
				<SubscriptionDialog
					open={isSubscriptionOpen}
					onOpenChange={setIsSubscriptionOpen}
				/>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button type="button" className="outline-none">
						<GatewaiIcon className="size-7 shrink-0 text-primary cursor-pointer hover:opacity-80 transition-opacity" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56 ml-2">
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link to="/canvas" className="cursor-pointer">
							<LayoutGrid className="mr-2 h-4 w-4" />
							<span>Back to workspace</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={() => setIsSettingsOpen(true)}
					>
						<Settings className="mr-2 h-4 w-4" />
						<span>API Keys</span>
					</DropdownMenuItem>
					{enablePricing && (
						<DropdownMenuItem
							className="cursor-pointer flex items-center justify-between group"
							onClick={() => setIsSubscriptionOpen(true)}
						>
							<div className="flex items-center gap-2">
								<span>Subscription</span>
							</div>
							{balance !== undefined && (
								<span className="text-[11px] font-semibold text-muted-foreground mr-1">
									<SparklesIcon size="sm" className="mr-1" />
									{balance.tokens.toLocaleString()}
								</span>
							)}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={async () => {
							await authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										nav("/auth/signin");
									},
								},
							});
						}}
					>
						<LogOut className="mr-2 h-4 w-4" />
						<span>Sign out</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
