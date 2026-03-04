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
	Switch,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	RiArrowLeftRightLine,
	RiArrowUpDownLine,
	RiFilmLine,
	RiSpeedLine,
	RiThermometerLine,
} from "react-icons/ri";
import {
	LOTTIE_DIMENSIONS,
	LOTTIE_DURATION,
	LOTTIE_FPS,
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
			temperature: nodeConfig?.temperature ?? 0,
			autoDimensions: nodeConfig?.autoDimensions ?? true,
			width: nodeConfig?.width ?? 512,
			height: nodeConfig?.height ?? 512,
			fps: nodeConfig?.fps ?? 30,
			duration: nodeConfig?.duration ?? 3,
		},
	});

	const autoDimensions = form.watch("autoDimensions");

	useEffect(() => {
		if (node?.config) {
			const config = node.config as LottieNodeConfig;
			form.reset({
				model: config.model,
				temperature: config.temperature ?? 0,
				autoDimensions: config.autoDimensions ?? true,
				width: config.width ?? 512,
				height: config.height ?? 512,
				fps: config.fps ?? 30,
				duration: config.duration ?? 3,
			});
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

				<FormField
					control={form.control}
					name="temperature"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Temperature</FormLabel>
							<FormControl>
								<DraggableNumberInput
									icon={RiThermometerLine}
									min={0}
									max={2}
									step={0.1}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
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
									min={LOTTIE_DIMENSIONS.min}
									max={LOTTIE_DIMENSIONS.max}
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
									min={LOTTIE_DIMENSIONS.min}
									max={LOTTIE_DIMENSIONS.max}
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
					name="fps"
					render={({ field }) => (
						<FormItem>
							<FormLabel>FPS</FormLabel>
							<FormControl>
								<DraggableNumberInput
									icon={RiSpeedLine}
									min={LOTTIE_FPS.min}
									max={LOTTIE_FPS.max}
									step={1}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="duration"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Duration (s)</FormLabel>
							<FormControl>
								<DraggableNumberInput
									icon={RiFilmLine}
									min={LOTTIE_DURATION.min}
									max={LOTTIE_DURATION.max}
									step={0.5}
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

export { LottieNodeConfigComponent };
