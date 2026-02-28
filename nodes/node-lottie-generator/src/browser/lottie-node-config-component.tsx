import { useCanvasCtx } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { Form, SelectField, SliderField } from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	LOTTIE_NODE_MODELS,
	type LottieNodeConfig,
	LottieNodeConfigSchema,
} from "../shared/config.js";

const LottieNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const nodeConfig = node.config as LottieNodeConfig;

	const form = useForm<LottieNodeConfig>({
		resolver: zodResolver(LottieNodeConfigSchema),
		defaultValues: {
			model: nodeConfig?.model,
			temperature: nodeConfig?.temperature,
		},
	});

	useEffect(() => {
		if (node?.config) {
			form.reset(node.config as LottieNodeConfig);
		}
	}, [node.config, form]);

	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (name) {
				onNodeConfigUpdate({
					id: node.id,
					newConfig: value as LottieNodeConfig,
				});
			}
		});
		return () => subscription.unsubscribe();
	}, [form, node.id, onNodeConfigUpdate]);

	return (
		<Form {...form}>
			<form className="space-y-4">
				<SelectField
					control={form.control}
					name="model"
					label="Model"
					placeholder="Select a model"
					options={LOTTIE_NODE_MODELS}
				/>

				<SliderField
					control={form.control}
					name="temperature"
					label="Temperature"
					min={0}
					max={2}
					step={0.1}
				/>
			</form>
		</Form>
	);
});

export { LottieNodeConfigComponent };
