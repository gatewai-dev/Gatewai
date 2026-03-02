import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	GatewaiIcon,
} from "@gatewai/ui-kit";
import { LayoutGrid, LogOut, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { ApiKeysSettings } from "./ApiKeysSettings";
import { SubscriptionDialog } from "./SubscriptionDialog";

export function UserMenu() {
	const nav = useNavigate();
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);

	return (
		<>
			<ApiKeysSettings open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
			<SubscriptionDialog
				open={isSubscriptionOpen}
				onOpenChange={setIsSubscriptionOpen}
			/>
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
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={() => setIsSubscriptionOpen(true)}
					>
						<Sparkles className="mr-2 h-4 w-4" />
						<span>Subscription</span>
					</DropdownMenuItem>
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
