import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_RESOLUTIONS,
	type VideoGenFirstLastFrameNodeConfig,
	VideoGenFirstLastFrameNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const VideoGenFirstLastFrameNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useCallback(
			(cfg: VideoGenFirstLastFrameNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as VideoGenFirstLastFrameNodeConfig;
		const form = useForm<VideoGenFirstLastFrameNodeConfig>({
			resolver: zodResolver(VideoGenFirstLastFrameNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model ?? VIDEOGEN_NODE_MODELS[0],
				aspectRatio: nodeConfig?.aspectRatio ?? "16:9",
				resolution: nodeConfig?.resolution ?? "720p",
				durationSeconds: "8", // Fixed per schema and docs
				personGeneration: nodeConfig?.personGeneration ?? "allow_adult", // Restricted to allow_adult per docs for interpolation
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as VideoGenFirstLastFrameNodeConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as VideoGenFirstLastFrameNodeConfig;
				if (
					val.model !== nodeConfig?.model ||
					val.aspectRatio !== nodeConfig?.aspectRatio ||
					val.resolution !== nodeConfig?.resolution ||
					val.personGeneration !== nodeConfig?.personGeneration
				) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig]);

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
					<div className="flex gap-4">
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
					</div>
				</form>
			</Form>
		);
	},
);

export { VideoGenFirstLastFrameNodeConfigComponent };
