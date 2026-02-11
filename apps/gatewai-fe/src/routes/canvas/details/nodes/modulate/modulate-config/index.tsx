import {
	type ModulateNodeConfig,
	ModulateNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@gatewai/ui-kit";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@gatewai/react-store";
import { SliderField } from "../../../components/fields/slider";

const ModulateNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const nodeConfig = node.config as ModulateNodeConfig;

		const updateConfig = useCallback(
			(cfg: ModulateNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);

		const form = useForm<ModulateNodeConfig>({
			resolver: zodResolver(ModulateNodeConfigSchema),
			defaultValues: {
				// Multiplicative identity is 1.0
				hue: nodeConfig?.hue ?? 0,
				saturation: nodeConfig?.saturation ?? 1,
				lightness: nodeConfig?.lightness ?? 1,
				brightness: nodeConfig?.brightness ?? 1,
			},
		});

		// Sync form with external state changes
		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as ModulateNodeConfig);
			}
		}, [node.config, form]);

		// Watch for changes and update canvas
		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as ModulateNodeConfig;
				// Simple comparison to prevent redundant updates
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
						label="Hue Rotation"
						min={0}
						max={360}
						step={1}
						info="Rotate colors around the wheel (0-360°)"
					/>
					<SliderField
						control={form.control}
						name="saturation"
						label="Saturation"
						min={0}
						max={2}
						step={0.01}
						info="1.0 is original. 0 is grayscale."
					/>
					<SliderField
						control={form.control}
						name="lightness"
						label="Lightness (Perceptual)"
						min={0}
						max={2}
						step={0.01}
						info="1.0 is original. 0 is black."
					/>
					<SliderField
						control={form.control}
						name="brightness"
						label="Brightness"
						min={0}
						max={2}
						step={0.01}
						info="1.0 is original. Multiplies final output."
					/>
				</form>
			</Form>
		);
	},
);

export { ModulateNodeConfigComponent };
