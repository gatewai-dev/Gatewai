import { useNodeUI } from "@gatewai/node-sdk/browser";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX, memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { LLMNodeConfigSchema } from "@/metadata.js";
import type { LLMNodeConfig } from "@/shared/config.js";

const LLMNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const { onNodeConfigUpdate } = useNodeUI();
	const nodeConfig = node.config as LLMNodeConfig;

	const form = useForm<LLMNodeConfig>({
		resolver: zodResolver(LLMNodeConfigSchema),
		defaultValues: {
			model: nodeConfig?.model,
			temperature: nodeConfig?.temperature,
		},
	});

	useEffect(() => {
		if (node?.config) {
			form.reset(node.config as LLMNodeConfig);
		}
	}, [node.config, form]);

	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (name) {
				onNodeConfigUpdate({
					id: node.id,
					newConfig: value as LLMNodeConfig,
				});
			}
		});
		return () => subscription.unsubscribe();
	}, [form, node.id, onNodeConfigUpdate]);

	return (
		<Form {...form}>
			<form className="space-y-4">
				<FormField
					control={form.control}
					name="model"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Model</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a model" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="gpt-4o">GPT-4o</SelectItem>
									<SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
									<SelectItem value="claude-3-5-sonnet-latest">
										Claude 3.5 Sonnet
									</SelectItem>
								</SelectContent>
							</Select>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="prompt"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Prompt Template</FormLabel>
							<FormControl>
								<Textarea
									{...field}
									placeholder="Enter your prompt template here..."
									className="min-h-[150px] font-mono text-sm"
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="temperature"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Temperature ({field.value})</FormLabel>
							<FormControl>
								<Input
									type="number"
									min={0}
									max={2}
									step={0.1}
									{...field}
									onChange={(e) =>
										field.onChange(Number.parseFloat(e.target.value))
									}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="maxTokens"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Max Tokens</FormLabel>
							<FormControl>
								<Input
									type="number"
									{...field}
									onChange={(e) =>
										field.onChange(Number.parseInt(e.target.value, 10))
									}
								/>
							</FormControl>
						</FormItem>
					)}
				/>
			</form>
		</Form>
	);
});

export { LLMNodeConfigComponent };
