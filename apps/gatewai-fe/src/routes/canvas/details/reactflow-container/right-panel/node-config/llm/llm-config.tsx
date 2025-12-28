import {
	LLM_NODE_MODELS,
	type LLMNodeConfig,
	LLMNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAppDispatch } from "@/store";
import { type NodeEntityType, updateNodeConfig } from "@/store/nodes";

const LLMNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const dispatch = useAppDispatch();

	const updateConfig = useCallback(
		(cfg: LLMNodeConfig) => {
			dispatch(updateNodeConfig({ id: node.id, newConfig: cfg }));
		},
		[dispatch, node.id],
	);

	const form = useForm<LLMNodeConfig>({
		resolver: zodResolver(LLMNodeConfigSchema),
		defaultValues: {
			model: LLM_NODE_MODELS[0],
		},
	});

	useEffect(() => {
		if (node?.config) {
			form.reset(node.config as LLMNodeConfig);
		}
	}, [node, form]);

	useEffect(() => {
		const subscription = form.watch((value) => {
			updateConfig(value as LLMNodeConfig);
		});
		return () => subscription.unsubscribe();
	}, [form, updateConfig]);

	return (
		<Form {...form}>
			<form className="space-y-6">
				<FormField
					control={form.control}
					name="model"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Model</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a model" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{LLM_NODE_MODELS.map((model) => (
										<SelectItem key={model} value={model}>
											{model}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
			</form>
		</Form>
	);
});

export { LLMNodeConfigComponent };
