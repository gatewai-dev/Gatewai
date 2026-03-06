import {
	appRPCClient,
	type PricingPlanListRPC,
	useGetBalanceQuery,
	useGetPlansQuery,
} from "@gatewai/react-store";
import { Button, Dialog, DialogContent, SparklesIcon } from "@gatewai/ui-kit";
import {
	CheckCircle2,
	CreditCard,
	ExternalLink,
	Globe2,
	Loader2,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiFireLine, RiLeafLine, RiRocketLine } from "react-icons/ri";
import { authClient } from "@/lib/auth-client";

// Use types directly from the RPC client
type Plan = PricingPlanListRPC[number];
type Benefit = { type: string; properties?: { units?: number } };
type SubscriptionItem = NonNullable<
	Awaited<ReturnType<typeof authClient.customer.subscriptions.list>>["data"]
>["result"]["items"][number];

// Icons matched to plan names
const PLAN_ICON_MAP: Record<string, React.ElementType> = {
	Basic: RiLeafLine,
	Pro: RiFireLine,
	Max: RiRocketLine,
};

const POLAR_BENEFITS = [
	{
		icon: Globe2,
		title: "Global Compliance",
		desc: "Automated VAT & Sales Tax",
	},
	{
		icon: ShieldCheck,
		title: "Bank-Grade Security",
		desc: "Encrypted checkout",
	},
	{
		icon: CreditCard,
		title: "Unified Billing",
		desc: "1-click self-serve portal",
	},
];

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
		{ pollingInterval: 90_000 },
	);
	const { data: plans = [], isLoading: plansLoading } = useGetPlansQuery();

	const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);
	const [subsLoading, setSubsLoading] = useState(false);

	// Store the raw fetched subscriptions to avoid dependency cycle loops
	const [activeSubs, setActiveSubs] = useState<SubscriptionItem[]>([]);

	// 1. Memoize plans to prevent unnecessary recalculations
	const typedPlans = useMemo(() => plans ?? [], [plans]);

	const sortedPlans = useMemo(() => {
		return [...typedPlans].sort((a, b) => {
			const priceA = a.prices?.[0]?.priceAmount ?? 0;
			const priceB = b.prices?.[0]?.priceAmount ?? 0;
			return priceA - priceB;
		});
	}, [typedPlans]);

	// 2. Derive the active subscription safely
	const activeSub = useMemo(() => {
		if (!activeSubs.length) return null;
		if (!sortedPlans.length) return activeSubs[0];

		const sorted = [...activeSubs].sort((a, b) => {
			const pa = sortedPlans.find((p) => p.id === a.productId);
			const pb = sortedPlans.find((p) => p.id === b.productId);
			const ta =
				(pa?.benefits as Benefit[] | undefined)?.find(
					(ben) => ben.type === "meter_credit",
				)?.properties?.units ?? -1;
			const tb =
				(pb?.benefits as Benefit[] | undefined)?.find(
					(ben) => ben.type === "meter_credit",
				)?.properties?.units ?? -1;

			return tb - ta;
		});
		return sorted[0];
	}, [activeSubs, sortedPlans]);

	// 3. Derive which plans to display
	const displayedPlans = useMemo(() => {
		return sortedPlans.filter(
			(p) => !p.isArchived || p.id === activeSub?.productId,
		);
	}, [sortedPlans, activeSub?.productId]);

	// 4. Fetch subscriptions strictly on modal open
	useEffect(() => {
		if (!open) {
			setActiveSubs([]);
			return;
		}

		let isMounted = true;
		setSubsLoading(true);

		authClient.customer.subscriptions
			.list({ query: { page: 1, limit: 10, active: true } })
			.then(({ data }) => {
				if (!isMounted) return;
				if (data?.result?.items?.length) {
					setActiveSubs(data.result.items);
				} else {
					setActiveSubs([]);
				}
			})
			.catch((err) => {
				console.error("Failed to fetch subscriptions", err);
				if (isMounted) setActiveSubs([]);
			})
			.finally(() => {
				if (isMounted) setSubsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [open]);

	const activePlan = sortedPlans.find((p) => p.id === activeSub?.productId);
	const activeIndex = Number(activePlan?.metadata?.tier || 0) || -1;

	async function handlePlanAction(plan: Plan) {
		setLoadingPlanId(plan.id);
		try {
			if (activeSub) {
				const res = await appRPCClient.api.v1.billing.subscription.update.$post(
					{
						json: { productId: plan.id },
					},
				);
				if (!res.ok) {
					console.error("Subscription update failed", await res.text());
					return;
				}
				const newData = await authClient.customer.subscriptions.list({
					query: { page: 1, limit: 10, active: true },
				});
				if (newData.data?.result?.items?.length) {
					// Update raw subscriptions; the useMemo will naturally recalculate activeSub
					setActiveSubs(newData.data.result.items);
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
		} catch (error) {
			console.error("Failed to open portal", error);
		} finally {
			setPortalLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[98vw]! max-w-[98vw]! max-h-[94vh]! h-auto lg:h-[88vh]! p-0 overflow-hidden bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg border border-white/50 dark:border-zinc-800/40 shadow-xl sm:rounded-[2.75rem] flex flex-col transition-all duration-500">
				{/* Ambient glow orbs */}
				<div
					className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.75rem]"
					aria-hidden
				>
					<div className="absolute -top-20 -left-20 w-[20rem] h-[20rem] rounded-full bg-primary/8 blur-2xl" />
					<div className="absolute -bottom-20 -right-20 w-[20rem] h-[20rem] rounded-full bg-primary/8 blur-2xl" />
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-primary/4 blur-xl" />
				</div>

				<div className="relative flex-1 flex flex-col overflow-hidden py-6">
					{/* Header */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between px-6 sm:px-12 pb-5 sm:pb-8 border-b border-zinc-200/60 dark:border-zinc-800/60">
						<div className="space-y-1.5">
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
							displayedPlans.map((plan) => {
								const tier = Number(plan.metadata?.tier || 0);
								const Icon = PLAN_ICON_MAP[plan.name] ?? RiLeafLine;
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
												? "bg-primary/5 dark:bg-primary/10 z-10 shadow-lg shadow-primary/5"
												: "bg-transparent"
										}`}
									>
										{highlight && (
											<div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary/80 to-primary/40" />
										)}

										<div className="flex items-center gap-3 mb-4 sm:mb-6">
											<div className="flex items-center justify-center size-10 rounded-xl border bg-primary/10 border-primary/20 shadow-sm">
												<Icon className="size-5 text-primary" />
											</div>
											<h3 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
												{plan.name}
											</h3>

											<div className="ml-auto flex items-center">
												{isCurrent && !subsLoading && (
													<span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-primary border border-primary/30 rounded-full px-2.5 py-1 bg-primary/10 backdrop-blur-sm">
														<CheckCircle2 className="size-3 shrink-0" />
														Current
													</span>
												)}
											</div>
										</div>

										<div className="mb-4 sm:mb-8">
											<div className="flex items-baseline gap-1.5 text-zinc-900 dark:text-zinc-50">
												<span className="text-3xl font-light tracking-tight tabular-nums">
													$
													{((plan.prices?.[0]?.priceAmount ?? 0) / 100).toFixed(
														2,
													)}
												</span>
												<span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
													/ mo
												</span>
											</div>
											<p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
												{Number(
													plan.benefits?.find((b) => b.type === "meter_credit")
														?.properties?.units || 0,
												).toLocaleString()}{" "}
												tokens / mo
												{highlight && (
													<span className="text-[10px] font-bold uppercase tracking-tighter text-primary opacity-80">
														(Most Popular)
													</span>
												)}
											</p>
										</div>

										<div className="w-full h-px bg-zinc-200/70 dark:bg-zinc-800/70 mb-4 sm:mb-8" />

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

										<div className="mt-auto pt-4">
											<Button
												size="lg"
												variant={isCurrent ? "outline" : "default"}
												className={`w-full h-11 text-sm font-medium transition-all rounded-xl ${
													!isCurrent
														? "shadow-md hover:shadow-lg hover:-translate-y-0.5"
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
													<p className="mt-2.5 text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
														{prorationNote}
													</p>
												)}
										</div>
									</div>
								);
							})
						)}
					</div>

					{/* Elegant Polar Trust Banner */}
					<div className="mt-2 sm:mt-6 mx-6 sm:mx-12 p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-sm">
						<div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
							<div className="space-y-1.5 max-w-sm">
								<div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
									<ShieldCheck className="size-4 text-primary" />
									<span>Processed securely by Polar</span>
								</div>
								<p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
									We partner with Polar as our Merchant of Record to handle
									global tax compliance and ensure a secure, seamless payment
									experience.
								</p>
							</div>

							<div className="flex flex-wrap items-center gap-4 sm:gap-8">
								{POLAR_BENEFITS.map((benefit) => (
									<div key={benefit.title} className="flex items-center gap-3">
										<div className="flex items-center justify-center size-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm">
											<benefit.icon className="size-3.5 text-zinc-600 dark:text-zinc-300" />
										</div>
										<div className="flex flex-col">
											<span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
												{benefit.title}
											</span>
											<span className="text-[10px] text-zinc-500 dark:text-zinc-400">
												{benefit.desc}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
