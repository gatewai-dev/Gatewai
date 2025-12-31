import {
	IMAGEGEN_NODE_MODELS,
	type ImageGenConfig,
	ImageGenNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const ImageGenNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useCallback(
			(cfg: ImageGenConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as ImageGenConfig;
		const form = useForm<ImageGenConfig>({
			resolver: zodResolver(ImageGenNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model,
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as ImageGenConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as ImageGenConfig;
				if (val.model !== nodeConfig?.model) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig?.model]);

		return (
			<Form {...form}>
				<form className="space-y-6">
					<SelectField
						control={form.control}
						name="model"
						label="Model"
						placeholder="Select a model"
						options={IMAGEGEN_NODE_MODELS}
					/>
				</form>
			</Form>
		);
	},
);

export { ImageGenNodeConfigComponent };
