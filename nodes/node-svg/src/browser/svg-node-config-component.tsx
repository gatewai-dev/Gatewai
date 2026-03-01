import { useCanvasCtx } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { Form, SelectField, SliderField } from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	SVG_NODE_MODELS,
	type SvgNodeConfig,
	SvgNodeConfigSchema,
} from "../shared/config.js";

const SvgNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const nodeConfig = node.config as SvgNodeConfig;

	const form = useForm<SvgNodeConfig>({
		resolver: zodResolver(SvgNodeConfigSchema),
		defaultValues: {
			model: nodeConfig?.model,
		},
	});

	useEffect(() => {
		if (node?.config) {
			form.reset(node.config as SvgNodeConfig);
		}
	}, [node.config, form]);

	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (name) {
				onNodeConfigUpdate({
					id: node.id,
					newConfig: value as SvgNodeConfig,
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
					options={SVG_NODE_MODELS}
				/>
			</form>
		</Form>
	);
});

export { SvgNodeConfigComponent };
