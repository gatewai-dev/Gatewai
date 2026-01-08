import {
	type TextMergerNodeConfig,
	TextMergerNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextIcon } from "lucide-react"; // Assuming lucide-react for icons; install if needed
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";

const TextMergerNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const nodeConfig = node.config as TextMergerNodeConfig;

		const updateConfig = useCallback(
			(cfg: TextMergerNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);

		const form = useForm<TextMergerNodeConfig>({
			resolver: zodResolver(TextMergerNodeConfigSchema),
			defaultValues: {
				join: nodeConfig?.join ?? " ",
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as TextMergerNodeConfig);
			}
		}, [node.config, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as TextMergerNodeConfig;
				if (val.join !== nodeConfig?.join) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig?.join]);

		const currentJoin = form.watch("join");

		// Define presets. Use "__EMPTY__" to handle empty string in Select.
		const presets = [
			{ label: "Space ( )", value: " " },
			{ label: "Newline (\\n)", value: "\\n" },
			{ label: "Comma (, )", value: ", " },
			{ label: "None (Empty)", value: "__EMPTY__" },
		];

		const effectiveValue = currentJoin === "" ? "__EMPTY__" : currentJoin;
		const isCustom = !presets.find((p) => p.value === effectiveValue);

		// Example inputs for preview
		const exampleInputs = ["Hello", "world", "from", "Grok"];
		const previewText = exampleInputs.join(
			currentJoin === "\\n" ? "\n" : currentJoin,
		);

		return (
			<div className="p-4 space-y-6 bg-background rounded-lg shadow-md">
				<div className="flex items-center gap-2">
					<TextIcon className="w-5 h-5 text-primary" />
					<h3 className="text-lg font-semibold">Text Merger Node</h3>
				</div>
				<p className="text-sm text-muted-foreground">
					This node combines multiple text inputs into a single output string
					using a specified separator. In your xyflow workflow app, connect as
					many sources as needed to the node's multiple input handles for
					dynamic merging. The order of connections determines the merge
					sequence.
				</p>
				<Separator />
				<Form {...form}>
					<form className="space-y-6">
						<FormField
							control={form.control}
							name="join"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Join Separator</FormLabel>
									<Select
										onValueChange={(val) => {
											if (val === "custom") {
												field.onChange("---"); // Default custom value
											} else if (val === "__EMPTY__") {
												field.onChange("");
											} else {
												field.onChange(val);
											}
										}}
										value={isCustom ? "custom" : effectiveValue}
									>
										<FormControl>
											<SelectTrigger className="bg-card border-muted">
												<SelectValue placeholder="Select a separator" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{presets.map((p) => (
												<SelectItem key={p.value} value={p.value}>
													{p.label}
												</SelectItem>
											))}
											<SelectItem value="custom">Custom String...</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										Choose how to separate the merged text inputs. Presets
										provide common options, or use custom for flexibility.
									</FormDescription>
								</FormItem>
							)}
						/>

						{isCustom && (
							<FormField
								control={form.control}
								name="join"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Custom Separator</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="Enter custom separator (e.g., --- or ; )"
												value={field.value ?? ""}
												className="bg-card border-muted"
											/>
										</FormControl>
										<FormDescription>
											Supports special characters like \n for newlines.
										</FormDescription>
									</FormItem>
								)}
							/>
						)}
					</form>
				</Form>
				<Separator />
				<div className="space-y-2">
					<Label>Preview</Label>
					<div className="p-3 bg-card border border-muted rounded-md whitespace-pre-wrap text-sm">
						{previewText || "(No separator selected)"}
					</div>
					<p className="text-xs text-muted-foreground">
						Example merge of: "{exampleInputs.join('", "')}"
					</p>
				</div>
			</div>
		);
	},
);

export { TextMergerNodeConfigComponent };
