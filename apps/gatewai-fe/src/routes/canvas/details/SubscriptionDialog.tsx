import { appRPCClient, useGetBalanceQuery } from "@gatewai/react-store";
import { Button, Dialog, DialogContent } from "@gatewai/ui-kit";
import {
	CheckCircle2,
	Coins,
	ExternalLink,
	Loader2,
	Sparkles,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

const BASIC_PRODUCT_ID = "608a6922-2db6-4b97-b1f3-bbcf4765e75e";
const PRO_PRODUCT_ID = "b9fb573b-23e3-4ee7-adfc-778efc753e69";
const MAX_PRODUCT_ID = "ca6587d9-00f9-48b6-91aa-50b8c6a2a47b";

// Tier index — higher index = higher tier
const PLAN_TIER: Record<string, number> = {
	[BASIC_PRODUCT_ID]: 0,
	[PRO_PRODUCT_ID]: 1,
	[MAX_PRODUCT_ID]: 2,
};

interface Plan {
	id: string;
	name: string;
	tokens: number;
	price: string;
	priceNote: string;
	icon: typeof Coins;
	features: string[];
	highlight?: boolean;
}

const PLANS: Plan[] = [
	{
		id: BASIC_PRODUCT_ID,
		name: "Basic",
		tokens: 200,
		price: "$19",
		priceNote: "per month",
		icon: Coins,
		features: ["200 tokens / month", "All node types", "Auto-refilled monthly"],
	},
	{
		id: PRO_PRODUCT_ID,
		name: "Pro",
		tokens: 1000,
		price: "$49",
		priceNote: "per month",
		icon: Zap,
		features: [
			"1,000 tokens / month",
			"All node types",
			"Priority processing",
			"Premium support",
		],
		highlight: true,
	},
	{
		id: MAX_PRODUCT_ID,
		name: "Max",
		tokens: 5000,
		price: "$249",
		priceNote: "per month",
		icon: Sparkles,
		features: [
			"5,000 tokens / month",
			"All node types",
			"Highest priority queue",
			"Dedicated account manager",
		],
	},
];

interface ActiveSub {
	productId: string;
	status: string;
}

interface SubscriptionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SubscriptionDialog({
	open,
	onOpenChange,
}: SubscriptionDialogProps) {
	const { data: balance, isLoading: balanceLoading } = useGetBalanceQuery(
		undefined,
		{ pollingInterval: 30_000 },
	);
	const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);
	const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
	const [subsLoading, setSubsLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setSubsLoading(true);
		authClient.customer.subscriptions
			.list({ query: { page: 1, limit: 10, active: true } })
			.then(({ data }) => {
				if (!data?.result?.items?.length) {
					setActiveSub(null);
					return;
				}
				const sorted = [...data.result.items].sort((a, b) => {
					const ta = PLAN_TIER[a.productId] ?? -1;
					const tb = PLAN_TIER[b.productId] ?? -1;
					return tb - ta;
				});
				const top = sorted[0];
				setActiveSub({ productId: top.productId, status: top.status });
			})
			.catch(() => setActiveSub(null))
			.finally(() => setSubsLoading(false));
	}, [open]);

	const activeIndex = activeSub ? (PLAN_TIER[activeSub.productId] ?? -1) : -1;

	/**
	 * For first-time subscribers → Polar checkout flow.
	 * For existing subscribers upgrading/downgrading → backend subscription update with proration.
	 */
	async function handlePlanAction(plan: Plan) {
		setLoadingPlanId(plan.id);
		try {
			if (activeSub) {
				// Update existing subscription with proration
				const res = await (
					appRPCClient.api.v1.billing as any
				).subscription.update.$post({
					json: { productId: plan.id },
				});
				if (!res.ok) {
					console.error("Subscription update failed", await res.text());
					return;
				}
				// Refresh the active subscription state
				const newData = await authClient.customer.subscriptions.list({
					query: { page: 1, limit: 10, active: true },
				});
				if (newData.data?.result?.items?.length) {
					const top = [...newData.data.result.items].sort(
						(a, b) =>
							(PLAN_TIER[b.productId] ?? -1) - (PLAN_TIER[a.productId] ?? -1),
					)[0];
					setActiveSub({ productId: top.productId, status: top.status });
				}
			} else {
				// No subscription yet — go through Polar checkout
				await authClient.checkout({
					products: [plan.id],
					successUrl: window.location.href,
				});
			}
		} catch (err) {
			console.error("Plan action failed", err);
		} finally {
			setLoadingPlanId(null);
		}
	}

	async function handleManage() {
		setPortalLoading(true);
		try {
			await authClient.customer.portal();
		} catch {
			// opens new tab
		} finally {
			setPortalLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* Elevated Container Sizing: Wider, beautifully rounded, strictly defined height bounds */}
			<DialogContent className="w-[98vw]! max-w-[98vw]! h-[90vh]! p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl sm:rounded-[2rem] flex flex-col">
				{/* Header Section */}
				<div className="flex flex-col gap-5 sm:flex-row sm:items-end justify-between px-8 sm:px-12 pt-10 pb-8 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
					<div className="space-y-1">
						<h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
							Choose your plan
						</h2>
						<p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
							Scale your workflow. Tokens refill automatically each month.
							Cancel anytime.
						</p>
					</div>

					<div className="flex items-center gap-3 shrink-0">
						{/* Token Balance Pill */}
						<div className="flex items-center gap-2 h-9 px-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm">
							<Coins className="size-4 text-zinc-400 shrink-0" />
							{balanceLoading ? (
								<Loader2 className="size-4 animate-spin text-zinc-400" />
							) : (
								<span className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
									{balance?.tokens?.toLocaleString() ?? 0} tokens
								</span>
							)}
						</div>

						{/* Portal Access */}
						{activeSub && (
							<Button
								size="sm"
								variant="outline"
								className="h-9 px-4 text-sm gap-2 rounded-full border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
								onClick={handleManage}
								disabled={portalLoading}
							>
								{portalLoading ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<ExternalLink className="size-3.5" />
								)}
								Manage Subscription
							</Button>
						)}
					</div>
				</div>

				{/* Plans Grid: Responsive, clean dividers, fluid height */}
				<div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto">
					{PLANS.map((plan, planIndex) => {
						const Icon = plan.icon;
						const isLoading = loadingPlanId === plan.id;
						const isCurrent = activeSub?.productId === plan.id;
						const isUpgrade =
							!isCurrent && planIndex > activeIndex && activeIndex !== -1;
						const isDowngrade = !isCurrent && planIndex < activeIndex;

						let ctaLabel: string;
						if (isCurrent) ctaLabel = "Current Plan";
						else if (isUpgrade) ctaLabel = `Upgrade to ${plan.name}`;
						else if (isDowngrade) ctaLabel = `Downgrade to ${plan.name}`;
						else ctaLabel = "Subscribe";

						// Proration note shown under the button
						const prorationNote = isUpgrade
							? "Prorated charge billed today"
							: isDowngrade
								? "Takes effect next billing cycle"
								: null;

						return (
							<div
								key={plan.id}
								className={`relative flex flex-col p-8 sm:p-10 xl:p-12 transition-colors ${
									plan.highlight ? "bg-zinc-50/50 dark:bg-zinc-900/20" : ""
								}`}
							>
								{/* Subtle elegant highlight accent line for Popular tier */}
								{plan.highlight && (
									<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-zinc-200 dark:to-zinc-400" />
								)}

								{/* Plan Name & Icon */}
								<div className="flex items-center gap-3 mb-6">
									<div className="flex items-center justify-center size-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
										<Icon className="size-4.5 text-zinc-700 dark:text-zinc-300" />
									</div>
									<h3 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
										{plan.name}
									</h3>

									{/* Badges */}
									<div className="ml-auto flex items-center gap-2">
										{!isCurrent && plan.highlight && !subsLoading && (
											<span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
												Popular
											</span>
										)}
										{isCurrent && !subsLoading && (
											<span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-full px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40">
												<CheckCircle2 className="size-3 shrink-0" />
												Current
											</span>
										)}
									</div>
								</div>

								{/* Typography: Pricing */}
								<div className="mb-8">
									<div className="flex items-baseline gap-1.5 text-zinc-900 dark:text-zinc-50">
										<span className="text-5xl font-light tracking-tight tabular-nums">
											{plan.price}
										</span>
										<span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
											/mo
										</span>
									</div>
									<p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
										{plan.tokens.toLocaleString()} tokens included
									</p>
								</div>

								{/* Divider */}
								<div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 mb-8" />

								{/* Features List */}
								<ul className="space-y-4 mb-10 flex-1">
									{plan.features.map((f) => (
										<li
											key={f}
											className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300"
										>
											<svg
												className="size-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5"
												viewBox="0 0 16 16"
												fill="none"
											>
												<path
													d="M3.5 8L6.5 11L12.5 5"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											<span className="leading-snug">{f}</span>
										</li>
									))}
								</ul>

								{/* CTA Button - anchored to bottom using mt-auto */}
								<div className="mt-auto pt-4">
									<Button
										size="lg"
										variant={
											plan.highlight && !isCurrent ? "default" : "outline"
										}
										className={`w-full h-11 text-sm font-medium transition-all rounded-xl ${
											plan.highlight && !isCurrent
												? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 text-white shadow-md hover:shadow-lg"
												: isCurrent
													? "border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-default hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
													: "border-zinc-200 dark:border-zinc-700 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
										}`}
										disabled={isCurrent || isLoading || subsLoading}
										onClick={() => !isCurrent && handlePlanAction(plan)}
									>
										{isLoading || subsLoading ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											ctaLabel
										)}
									</Button>
									{prorationNote &&
										!isCurrent &&
										!isLoading &&
										!subsLoading && (
											<p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
												{prorationNote}
											</p>
										)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer Section */}
				<div className="px-8 sm:px-12 py-5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Processed securely by Polar.
					</p>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Need an enterprise plan?{" "}
						<a
							href="emailto:support@gatewai.studio"
							className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline underline-offset-4 transition-all"
						>
							Contact sales
						</a>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
