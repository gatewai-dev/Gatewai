import {
	type TextMergerNodeConfig,
	TextMergerNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";

const EMPTY_STRING_TOKEN = "__EMPTY_JOIN__";

const PRESETS = [
	{ label: "Space", value: " " },
	{ label: "Newline", value: "\n" },
	{ label: "Comma", value: ", " },
	{ label: "None (Empty)", value: EMPTY_STRING_TOKEN },
];

const TextMergerNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const nodeConfig = node.config as TextMergerNodeConfig;

		const form = useForm<TextMergerNodeConfig>({
			resolver: zodResolver(TextMergerNodeConfigSchema),
			defaultValues: {
				join: nodeConfig?.join ?? " ",
			},
		});

		const currentJoin = form.watch("join");

		// UI State for "Custom" mode
		const [isCustomMode, setIsCustomMode] = useState(() => {
			const initialVal = nodeConfig?.join ?? " ";
			return !PRESETS.some(
				(p) =>
					p.value === initialVal ||
					(p.value === EMPTY_STRING_TOKEN && initialVal === ""),
			);
		});

		/**
		 * FIX 1: Prevent Recursive Resets
		 * We only reset the form if the external node.config is strictly
		 * different from the current form values.
		 */
		useEffect(() => {
			if (!node?.config) return;

			const currentValues = form.getValues();
			const hasChanged =
				JSON.stringify(node.config) !== JSON.stringify(currentValues);

			if (hasChanged) {
				form.reset(node.config as TextMergerNodeConfig);
			}
		}, [node.config, form]);

		/**
		 * FIX 2: Stable Update Handler
		 * Using a subscription is fine, but we ensure the callback is stable.
		 */
		useEffect(() => {
			const subscription = form.watch((value, { name }) => {
				// If the change came from a reset (externally), don't push it back
				if (!name) return;

				onNodeConfigUpdate({
					id: node.id,
					newConfig: value as TextMergerNodeConfig,
				});
			});
			return () => subscription.unsubscribe();
		}, [form, node.id, onNodeConfigUpdate]);

		const handleSelectChange = (val: string) => {
			if (val === "custom") {
				setIsCustomMode(true);
			} else {
				setIsCustomMode(false);
				const actualValue = val === EMPTY_STRING_TOKEN ? "" : val;
				form.setValue("join", actualValue, {
					shouldDirty: true,
					shouldTouch: true,
				});
			}
		};

		const getDisplayValue = () => {
			if (isCustomMode) return "custom";
			if (currentJoin === "") return EMPTY_STRING_TOKEN;
			return currentJoin;
		};

		const exampleInputs = ["Text 1", "Text 2"];
		const processedJoin = currentJoin.replace(/\\n/g, "\n");
		const previewText = exampleInputs.join(processedJoin);

		return (
			<div className="p-4 space-y-3 bg-background rounded-lg shadow-sm">
				<Form {...form}>
					<form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
						<FormItem>
							<FormLabel className="text-sm font-semibold">
								Join Separator
							</FormLabel>
							<Select
								value={getDisplayValue()}
								onValueChange={handleSelectChange}
							>
								<FormControl>
									<SelectTrigger className="bg-card border-muted-foreground/20">
										<SelectValue placeholder="Select a separator" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{PRESETS.map((p) => (
										<SelectItem key={p.value} value={p.value}>
											{p.label}
										</SelectItem>
									))}
									<Separator className="my-1" />
									<SelectItem value="custom">Custom String...</SelectItem>
								</SelectContent>
							</Select>
						</FormItem>

						{isCustomMode && (
							<FormField
								control={form.control}
								name="join"
								render={({ field }) => (
									<FormItem className="animate-in fade-in slide-in-from-top-2 duration-200">
										<div className="flex justify-between items-center">
											<FormLabel className="text-xs font-medium">
												Custom Separator Value
											</FormLabel>
											<span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 rounded">
												Chars: {field.value?.length || 0}
											</span>
										</div>
										<FormControl>
											<Textarea
												{...field}
												placeholder="Enter custom separator (e.g. ' | ' or '\n')"
												className="bg-card font-mono text-sm resize-none"
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						)}
					</form>
				</Form>

				<div className="space-y-3 pt-2">
					<Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
						Handbook Preview
					</Label>
					<div className="flex flex-wrap gap-1.5">
						{exampleInputs.map((input) => (
							<span
								key={`${input}_opt`}
								className="px-2 py-0.5 rounded border border-border bg-background text-[10px] text-muted-foreground"
							>
								"{input}"
							</span>
						))}
					</div>
					<div className="relative">
						<div className="p-2 bg-muted/40 border border-dashed border-border rounded-md whitespace-pre-wrap wrap-break-word text-xs text-left transition-colors font-mono">
							{previewText || (
								<span className="text-muted-foreground italic opacity-60">
									No separator (Concatenated)
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	},
);

export { TextMergerNodeConfigComponent };
