import { useNodeUI } from "@gatewai/node-sdk/browser";
import type { NodeEntityType } from "@gatewai/react-store";
import { SelectField } from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { Form, useForm } from "react-hook-form";
import {
	type SpeechToTextNodeConfig,
	SpeechToTextNodeConfigSchema,
	STT_NODE_MODELS,
} from "@/shared/config.js";

const SpeechToTextNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useNodeUI();
		const updateConfig = useCallback(
			(cfg: SpeechToTextNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as SpeechToTextNodeConfig;
		const form = useForm<SpeechToTextNodeConfig>({
			resolver: zodResolver(SpeechToTextNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model,
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as SpeechToTextNodeConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as SpeechToTextNodeConfig;
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
						options={STT_NODE_MODELS}
					/>
				</form>
			</Form>
		);
	},
);

export { SpeechToTextNodeConfigComponent };
