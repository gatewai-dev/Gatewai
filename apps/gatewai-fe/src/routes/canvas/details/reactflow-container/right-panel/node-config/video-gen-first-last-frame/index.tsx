import type { NodeEntityType } from "@gatewai/react-store";
import {
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_RESOLUTIONS,
	type VideoGenFirstLastFrameNodeConfig,
	VideoGenFirstLastFrameNodeConfigSchema,
} from "@gatewai/types";
import { Form } from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
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
				model: nodeConfig?.model ?? "veo-3.1-generate-preview",
				resolution: nodeConfig?.resolution ?? "720p",
				// Duration is often fixed to 8s or limited for first-last frame
				durationSeconds: nodeConfig?.durationSeconds ?? "8",
				personGeneration: nodeConfig?.personGeneration ?? "allow_all",
				// Aspect ratio is typically inferred from the first frame or locked to 16:9
				aspectRatio: "16:9",
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
				// Only trigger update if values actually changed to avoid cycles
				if (
					val.model !== nodeConfig?.model ||
					val.resolution !== nodeConfig?.resolution ||
					val.personGeneration !== nodeConfig?.personGeneration
				) {
					updateConfig(val);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig]);

		// Enforce resolution constraints for Veo models if needed
		useEffect(() => {
			const sub = form.watch((value, { name }) => {
				if (name === "resolution") {
					const val = value as VideoGenFirstLastFrameNodeConfig;
					// Example: Ensure 1080p is only used if duration is 8s (if mutable)
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
						// Filter for models that support interpolation if needed, or use all
						options={VIDEOGEN_NODE_MODELS}
					/>

					<div className="flex flex-row gap-4">
						<div className="flex-1">
							<SelectField
								control={form.control}
								name="resolution"
								label="Resolution"
								placeholder="Select resolution"
								options={VIDEOGEN_RESOLUTIONS}
							/>
						</div>
						<div className="flex-1 opacity-80 pointer-events-none">
							<SelectField
								control={form.control}
								name="durationSeconds"
								label="Duration (Fixed)"
								placeholder="8"
								options={["8"]}
								disabled={true}
							/>
						</div>
					</div>
				</form>
			</Form>
		);
	},
);

export { VideoGenFirstLastFrameNodeConfigComponent };
