import {
	type ModulateNodeConfig,
	ModulateNodeConfigSchema,
} from "@gatewai/types"; // Adjust import path as needed
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SliderField } from "../../../components/fields/slider";

const ModulateNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useCallback(
			(cfg: ModulateNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as ModulateNodeConfig;
		const form = useForm<ModulateNodeConfig>({
			resolver: zodResolver(ModulateNodeConfigSchema),
			defaultValues: {
				hue: nodeConfig?.hue ?? 0,
				saturation: nodeConfig?.saturation ?? 0,
				lightness: nodeConfig?.lightness ?? 0,
				brightness: nodeConfig?.brightness ?? 0,
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as ModulateNodeConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as ModulateNodeConfig;
				if (
					val.hue !== nodeConfig?.hue ||
					val.saturation !== nodeConfig?.saturation ||
					val.lightness !== nodeConfig?.lightness ||
					val.brightness !== nodeConfig?.brightness
				) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [
			form,
			updateConfig,
			nodeConfig?.hue,
			nodeConfig?.saturation,
			nodeConfig?.lightness,
			nodeConfig?.brightness,
		]);

		return (
			<Form {...form}>
				<form className="space-y-6">
					<SliderField
						control={form.control}
						name="hue"
						label="Hue"
						min={-180}
						max={180}
						step={1}
					/>
					<SliderField
						control={form.control}
						name="saturation"
						label="Saturation"
						min={-1}
						max={1}
						step={0.01}
					/>
					<SliderField
						control={form.control}
						name="lightness"
						label="Lightness"
						min={-1}
						max={1}
						step={0.01}
					/>
					<SliderField
						control={form.control}
						name="brightness"
						label="Brightness"
						min={-1}
						max={1}
						step={0.01}
					/>
				</form>
			</Form>
		);
	},
);

export { ModulateNodeConfigComponent };
