import {
	appRPCClient,
	type PricingPlanListRPC,
	useGetBalanceQuery,
	useGetPlansQuery,
} from "@gatewai/react-store";
import { Button, Dialog, DialogContent, SparklesIcon } from "@gatewai/ui-kit";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RiFireLine, RiLeafLine, RiRocketLine } from "react-icons/ri";
import { authClient } from "@/lib/auth-client";

// Icons matched to plan names
const PLAN_ICON_MAP: Record<string, React.ElementType> = {
	Basic: RiLeafLine,
	Pro: RiFireLine,
	Max: RiRocketLine,
};

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
	const { data: plans = [], isLoading: plansLoading } = useGetPlansQuery();
	const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);
	const [activeSub, setActiveSub] = useState<
		| NonNullable<
				Awaited<
					ReturnType<typeof authClient.customer.subscriptions.list>
				>["data"]
		  >["result"]["items"][number]
		| null
	>(null);
	const [subsLoading, setSubsLoading] = useState(false);

	const sortedPlans = [...plans].sort((a, b) => {
		const priceA = (a.prices?.[0] as any)?.priceAmount ?? 0;
		const priceB = (b.prices?.[0] as any)?.priceAmount ?? 0;
		return priceA - priceB;
	});
	const displayedPlans = sortedPlans.filter(
		(p) => !p.isArchived || p.id === activeSub?.productId,
	);

	useEffect(() => {
		if (!open || !displayedPlans.length) return;
		setSubsLoading(true);
		authClient.customer.subscriptions
			.list({ query: { page: 1, limit: 10, active: true } })
			.then(({ data }) => {
				if (!data?.result?.items?.length) {
					setActiveSub(null);
					return;
				}
				const sorted = [...data.result.items].sort((a, b) => {
					const pa = sortedPlans.find((p) => p.id === a.productId) as any;
					const pb = sortedPlans.find((p) => p.id === b.productId) as any;
					const ta =
						(pa?.benefits?.find((b: any) => b.type === "meter_credit") as any)
							?.properties?.units ?? -1;
					const tb =
						(pb?.benefits?.find((b: any) => b.type === "meter_credit") as any)
							?.properties?.units ?? -1;
					return tb - ta;
				});
				setActiveSub(sorted[0]);
			})
			.catch(() => setActiveSub(null))
			.finally(() => setSubsLoading(false));
	}, [open, plans]);

	const activePlan = sortedPlans.find((p) => p.id === activeSub?.productId);
	const activeIndex = Number(activePlan?.metadata?.tier || 0) || -1;

	async function handlePlanAction(plan: PricingPlanListRPC[number]) {
		setLoadingPlanId(plan.id);
		try {
			if (activeSub) {
				const res = await (
					appRPCClient.api.v1.billing.subscription as any
				).update.$post({
					json: { productId: plan.id },
				});
				if (!res.ok) {
					console.error("Subscription update failed", await res.text());
					return;
				}
				const newData = await authClient.customer.subscriptions.list({
					query: { page: 1, limit: 10, active: true },
				});
				if (newData.data?.result?.items?.length) {
					const top = [...newData.data.result.items].sort((a, b) => {
						const pa = plans.find((p) => p.id === a.productId) as any;
						const pb = plans.find((p) => p.id === b.productId) as any;
						const ta =
							(pa?.benefits?.find((b: any) => b.type === "meter_credit") as any)
								?.properties?.units ?? -1;
						const tb =
							(pb?.benefits?.find((b: any) => b.type === "meter_credit") as any)
								?.properties?.units ?? -1;
						return tb - ta;
					})[0];
					setActiveSub(top);
				}
			} else {
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
			{/* Reduced glass effect: bg opacity increased from /75 to /90, backdrop-blur reduced from -2xl to -lg, shadow-2xl reduced to shadow-xl */}
			<DialogContent className="w-[98vw]! max-w-[98vw]! max-h-[94vh]! h-auto lg:h-[88vh]! p-0 overflow-hidden bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg border border-white/50 dark:border-zinc-800/40 shadow-xl sm:rounded-[2.75rem] flex flex-col transition-all duration-500">
				{/* Reduced ambient glow orbs — unified primary color, smaller size and less blur */}
				<div
					className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.75rem]"
					aria-hidden
				>
					<div className="absolute -top-20 -left-20 w-[20rem] h-[20rem] rounded-full bg-primary/8 blur-2xl" />
					<div className="absolute -bottom-20 -right-20 w-[20rem] h-[20rem] rounded-full bg-primary/8 blur-2xl" />
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-primary/4 blur-xl" />
				</div>

				{/* Inner scroll container */}
				<div className="relative flex-1 flex flex-col overflow-hidden py-6">
					{/* Header */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between px-6 sm:px-12 pb-5 sm:pb-8 border-b border-zinc-200/60 dark:border-zinc-800/60">
						<div className="space-y-1">
							<h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
								Choose your plan
							</h2>
							<p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
								Scale your workflow. Tokens refill automatically each month.
								Cancel anytime.
							</p>
						</div>

						<div className="flex items-center gap-3 shrink-0">
							<div className="flex items-center gap-2 h-9 px-4 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-primary/20 shadow-sm">
								<SparklesIcon className="text-primary" />
								{balanceLoading ? (
									<Loader2 className="size-4 animate-spin text-muted-foreground" />
								) : (
									<span className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
										{balance?.tokens?.toLocaleString() ?? 0}
									</span>
								)}
							</div>

							{activeSub && (
								<Button
									size="sm"
									variant="outline"
									className="h-9 px-4 text-sm gap-2 rounded-full border-primary/20 bg-primary/15 hover:bg-primary/20 backdrop-blur-sm shadow-sm text-primary transition-colors"
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

					{/* Plans Grid */}
					<div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200/60 dark:divide-zinc-800/60 overflow-y-auto">
						{plansLoading ? (
							<div className="col-span-3 flex items-center justify-center h-full">
								<Loader2 className="size-8 animate-spin text-primary" />
							</div>
						) : (
							displayedPlans.map((plan: any) => {
								const tier = Number(plan.metadata?.tier || 0);
								const Icon = PLAN_ICON_MAP[plan.name as string] ?? RiLeafLine;
								const isLoading = loadingPlanId === plan.id;
								const isCurrent = activeSub?.productId === plan.id;
								const isUpgrade =
									!isCurrent && tier > activeIndex && activeIndex !== -1;
								const isDowngrade = !isCurrent && tier < activeIndex;
								const highlight = plan.name === "Pro";

								let ctaLabel: string;
								if (isCurrent) ctaLabel = "Current Plan";
								else if (isUpgrade) ctaLabel = `Upgrade to ${plan.name}`;
								else if (isDowngrade) ctaLabel = `Downgrade to ${plan.name}`;
								else ctaLabel = "Subscribe";

								const prorationNote = isUpgrade
									? "Prorated charge billed today"
									: isDowngrade
										? "Takes effect next billing cycle"
										: null;

								return (
									<div
										key={plan.id}
										className={`relative flex flex-col p-4 sm:p-6 xl:p-8 transition-all duration-500 ${
											highlight
												? "bg-primary/10 z-10 shadow-lg shadow-primary/8"
												: "bg-transparent"
										}`}
									>
										{/* Accent bar at top of highlighted plan */}
										{highlight && (
											<div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary/80 to-primary/40" />
										)}

										{/* Plan header */}
										<div className="flex items-center gap-2 mb-4 sm:mb-6">
											<div className="flex items-center justify-center size-10 rounded-xl border bg-primary/10 border-primary/20">
												<Icon className="size-[1.125rem] text-primary" />
											</div>
											<h3 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
												{plan.name}
											</h3>

											<div className="ml-auto flex items-center gap-2">
												{isCurrent && !subsLoading && (
													<span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-primary border border-primary/30 rounded-full px-2.5 py-1 bg-primary/20 backdrop-blur-sm">
														<CheckCircle2 className="size-3 shrink-0" />
														Current
													</span>
												)}
											</div>
										</div>

										{/* Pricing */}
										<div className="mb-4 sm:mb-8">
											<div className="flex items-baseline gap-1.5 text-zinc-900 dark:text-zinc-50">
												<span className="text-2xl font-light tracking-tight tabular-nums">
													$
													{(
														((plan.prices?.[0] as any)?.priceAmount ?? 0) / 100
													).toFixed(2)}
												</span>
												<span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
													/ mo
												</span>
											</div>
											<p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
												{Number(
													(
														(plan as any).benefits?.find(
															(b: any) => b.type === "meter_credit",
														) as any
													)?.properties?.units || 0,
												).toLocaleString()}{" "}
												tokens / mo
												{highlight && (
													<span className="text-[10px] font-bold uppercase tracking-tighter text-primary opacity-70">
														(Most Used Plan)
													</span>
												)}
											</p>
										</div>

										{/* Divider */}
										<div className="w-full h-px bg-zinc-200/70 dark:bg-zinc-800/70 mb-4 sm:mb-8" />

										{/* Features */}
										<ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-10 flex-1">
											{(plan.description
												? plan.description
														.split("\n")
														.map((f: string) =>
															f.replace(/^[*-]\s*/, "").trim(),
														)
														.filter(Boolean)
												: []
											).map((f: string) => (
												<li
													key={f}
													className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300"
												>
													<svg
														className="size-4 shrink-0 mt-0.5 text-primary"
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

										{/* CTA */}
										<div className="mt-auto pt-4">
											<Button
												size="lg"
												variant="outline"
												className={`w-full h-11 text-sm font-medium transition-all rounded-xl ${
													!isCurrent
														? "shadow-md hover:shadow-lg border-none"
														: "cursor-default"
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
							})
						)}
					</div>

					{/* Footer */}
					<div className="px-6 sm:px-12 pt-4 sm:pt-5 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Processed securely by Polar.
						</p>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Need an enterprise plan?{" "}
							<a
								href="mailto:support@gatewai.studio"
								className="font-medium text-primary hover:underline underline-offset-4 transition-all"
							>
								Contact sales
							</a>
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
