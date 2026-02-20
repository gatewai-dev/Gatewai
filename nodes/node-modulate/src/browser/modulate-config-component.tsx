import { useCanvasCtx } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { Form, SliderField } from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type ModulateNodeConfig,
	ModulateNodeConfigSchema,
} from "../shared/config.js";

const ModulateConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
	const { onNodeConfigUpdate } = useCanvasCtx();

	const form = useForm<ModulateNodeConfig>({
		resolver: zodResolver(ModulateNodeConfigSchema),
		defaultValues: node.config as ModulateNodeConfig,
	});

	useEffect(() => {
		if (node?.config) {
			const currentValues = form.getValues();
			const newConfig = node.config as ModulateNodeConfig;

			// Prevent infinite loop by only resetting if values actually changed
			if (
				currentValues.hue !== newConfig.hue ||
				currentValues.saturation !== newConfig.saturation ||
				currentValues.brightness !== newConfig.brightness ||
				currentValues.lightness !== newConfig.lightness
			) {
				form.reset(newConfig);
			}
		}
	}, [node.config, form]);

	useEffect(() => {
		const subscription = form.watch((value) => {
			onNodeConfigUpdate({
				id: node.id,
				newConfig: value as ModulateNodeConfig,
			});
		});
		return () => subscription.unsubscribe();
	}, [form, node.id, onNodeConfigUpdate]);

	return (
		<Form {...form}>
			<form className="flex flex-col gap-4 p-1">
				<SliderField
					control={form.control}
					name="hue"
					label="HUE"
					min={0}
					max={360}
					step={1}
				/>
				<SliderField
					control={form.control}
					name="saturation"
					label="SATURATION"
					min={0}
					max={2}
					step={0.01}
				/>
				<SliderField
					control={form.control}
					name="brightness"
					label="BRIGHTNESS"
					min={0}
					max={2}
					step={0.01}
				/>
				<SliderField
					control={form.control}
					name="lightness"
					label="LIGHTNESS"
					min={0}
					max={2}
					step={0.01}
				/>
			</form>
		</Form>
	);
});

export { ModulateConfigComponent };
