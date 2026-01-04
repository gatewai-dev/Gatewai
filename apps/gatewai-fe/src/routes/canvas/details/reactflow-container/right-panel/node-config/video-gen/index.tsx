import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_DURATIONS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	VIDEOGEN_RESOLUTIONS,
	type VideoGenNodeConfig,
	VideoGenNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const VideoGenNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useCallback(
			(cfg: VideoGenNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as VideoGenNodeConfig;
		const form = useForm<VideoGenNodeConfig>({
			resolver: zodResolver(VideoGenNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model ?? VIDEOGEN_NODE_MODELS[0],
				aspectRatio: nodeConfig?.aspectRatio ?? "16:9",
				resolution: nodeConfig?.resolution ?? "720p",
				durationSeconds: nodeConfig?.durationSeconds ?? "8",
				personGeneration: nodeConfig?.personGeneration ?? "allow_all", // Restricted to allow_all per docs for text-to-video
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as VideoGenNodeConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as VideoGenNodeConfig;
				if (
					val.model !== nodeConfig?.model ||
					val.aspectRatio !== nodeConfig?.aspectRatio ||
					val.resolution !== nodeConfig?.resolution ||
					val.durationSeconds !== nodeConfig?.durationSeconds ||
					val.personGeneration !== nodeConfig?.personGeneration
				) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig]);

		// Handle edge case: Auto-assign duration to "8" if resolution is "1080p" and duration is not "8"
		useEffect(() => {
			const sub = form.watch((value, { name }) => {
				if (name === "resolution" || name === "durationSeconds") {
					const val = value as VideoGenNodeConfig;
					if (val.resolution === "1080p" && val.durationSeconds !== "8") {
						form.setValue("durationSeconds", "8", {
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
						options={VIDEOGEN_NODE_MODELS}
					/>
					<SelectField
						control={form.control}
						name="aspectRatio"
						label="Aspect Ratio"
						placeholder="Select aspect ratio"
						options={VIDEOGEN_ASPECT_RATIOS}
					/>
					<SelectField
						control={form.control}
						name="resolution"
						label="Resolution"
						placeholder="Select resolution"
						options={VIDEOGEN_RESOLUTIONS}
					/>
					<SelectField
						control={form.control}
						name="durationSeconds"
						label="Duration (seconds)"
						placeholder="Select duration"
						options={VIDEOGEN_DURATIONS}
					/>
					<SelectField
						control={form.control}
						name="personGeneration"
						label="Person Generation"
						placeholder="Select person generation option"
						options={["allow_all"]} // Restricted per docs for text-to-video
					/>
				</form>
			</Form>
		);
	},
);

export { VideoGenNodeConfigComponent };
