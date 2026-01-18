import {
	LLM_NODE_MODELS,
	type LLMNodeConfig,
	LLMNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { SliderField } from "@/routes/canvas/details/components/fields/slider";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const LLMNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const updateConfig = useCallback(
		(cfg: LLMNodeConfig) => {
			onNodeConfigUpdate({ id: node.id, newConfig: cfg });
		},
		[node.id, onNodeConfigUpdate],
	);
	const nodeConfig = node.config as LLMNodeConfig;
	const form = useForm<LLMNodeConfig>({
		resolver: zodResolver(LLMNodeConfigSchema),
		defaultValues: {
			model: nodeConfig?.model,
			temperature: nodeConfig?.temperature ?? 0,
		},
	});

	useEffect(() => {
		if (node?.config) {
			form.reset(node.config as LLMNodeConfig);
		}
	}, [node, form]);

	useEffect(() => {
		const subscription = form.watch((value) => {
			const val = value as LLMNodeConfig;
			if (
				val.model !== nodeConfig?.model ||
				val.temperature !== nodeConfig?.temperature
			) {
				updateConfig(val);
			}
		});
		return () => subscription.unsubscribe();
	}, [form, updateConfig, nodeConfig?.model, nodeConfig?.temperature]);

	return (
		<Form {...form}>
			<form className="space-y-6">
				<SelectField
					control={form.control}
					name="model"
					label="Model"
					placeholder="Select a model"
					options={LLM_NODE_MODELS}
				/>
				<SliderField
					control={form.control}
					name="temperature"
					info="Temperature is a value between 0 and 2 that influences the randomness of the generated text. A lower temperature (e.g., 0.2) makes the output more focused and deterministic, while a higher value (e.g., 1.0) increases creativity and variability."
					label="Temperature"
					min={0}
					max={2}
					step={0.1}
				/>
			</form>
		</Form>
	);
});

export { LLMNodeConfigComponent };
