import { useCanvasCtx } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	DraggableNumberInput,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	SelectField,
	SliderField,
	Switch,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { RiArrowLeftRightLine, RiArrowUpDownLine } from "react-icons/ri";
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
			autoDimensions: nodeConfig?.autoDimensions ?? true,
			width: nodeConfig?.width ?? 1024,
			height: nodeConfig?.height ?? 1024,
		},
	});

	const autoDimensions = form.watch("autoDimensions");

	useEffect(() => {
		if (node?.config) {
			const config = node.config as SvgNodeConfig;
			form.reset({
				model: config.model,
				autoDimensions: config.autoDimensions ?? true,
				width: config.width ?? 1024,
				height: config.height ?? 1024,
			});
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

				<FormField
					control={form.control}
					name="autoDimensions"
					render={({ field }) => (
						<FormItem className="flex items-center justify-between gap-2">
							<FormLabel className="mb-0">Auto Dimensions</FormLabel>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="width"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Width (px)</FormLabel>
							<FormControl>
								<DraggableNumberInput
									icon={RiArrowLeftRightLine}
									min={1}
									max={4096}
									disabled={autoDimensions}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="height"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Height (px)</FormLabel>
							<FormControl>
								<DraggableNumberInput
									icon={RiArrowUpDownLine}
									min={1}
									max={4096}
									disabled={autoDimensions}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</form>
		</Form>
	);
});

export { SvgNodeConfigComponent };
