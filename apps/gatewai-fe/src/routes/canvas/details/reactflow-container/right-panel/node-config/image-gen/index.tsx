import {
	IMAGEGEN_ASPECT_RATIOS,
	IMAGEGEN_IMAGE_SIZES,
	IMAGEGEN_NODE_MODELS,
	type ImageGenConfig,
	ImageGenNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { debounce, isEqual } from "lodash";
import { memo, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@gatewai/react-store";
import { SelectField } from "../../../../components/fields/select";

const ImageGenNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useMemo(
			() =>
				debounce((cfg: ImageGenConfig) => {
					onNodeConfigUpdate({ id: node.id, newConfig: cfg });
				}, 500),
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as ImageGenConfig;
		const form = useForm<ImageGenConfig>({
			resolver: zodResolver(ImageGenNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model ?? IMAGEGEN_NODE_MODELS[0],
				aspectRatio: nodeConfig?.aspectRatio ?? "1:1",
				imageSize: nodeConfig?.imageSize ?? "1K",
			},
		});

		useEffect(() => {
			if (node?.config) {
				const currentValues = form.getValues();
				if (!isEqual(node.config, currentValues)) {
					form.reset(node.config as ImageGenConfig);
				}
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as ImageGenConfig;
				if (
					val.model !== nodeConfig?.model ||
					val.aspectRatio !== nodeConfig?.aspectRatio ||
					val.imageSize !== nodeConfig?.imageSize
				) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig]);

		// Handle edge case: Auto-assign imageSize to "1K" if model is flash and imageSize is not "1K"
		useEffect(() => {
			const sub = form.watch((value, { name }) => {
				if (name === "model" || name === "imageSize") {
					const val = value as ImageGenConfig;
					if (
						val.model === "gemini-2.5-flash-image" &&
						val.imageSize !== "1K"
					) {
						form.setValue("imageSize", "1K", {
							shouldValidate: true,
							shouldDirty: true,
						});
					}
				}
			});
			return () => sub.unsubscribe();
		}, [form]);

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
					{form.watch("model") === "gemini-3-pro-image-preview" && (
						<div className="flex gap-4">
							<SelectField
								control={form.control}
								name="aspectRatio"
								label="Aspect Ratio"
								placeholder="Select aspect ratio"
								options={IMAGEGEN_ASPECT_RATIOS}
							/>
							<SelectField
								control={form.control}
								name="imageSize"
								label="Image Size"
								placeholder="Select image size"
								options={IMAGEGEN_IMAGE_SIZES}
							/>
						</div>
					)}
				</form>
			</Form>
		);
	},
);

export { ImageGenNodeConfigComponent };
