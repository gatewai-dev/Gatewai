import {
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	type VideoGenExtendNodeConfig,
	VideoGenExtendNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form, FormDescription } from "@/components/ui/form";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const VideoGenExtendNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();

		const updateConfig = useCallback(
			(cfg: VideoGenExtendNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);

		const nodeConfig = node.config as VideoGenExtendNodeConfig;

		const form = useForm<VideoGenExtendNodeConfig>({
			resolver: zodResolver(VideoGenExtendNodeConfigSchema),
			defaultValues: {
				model: nodeConfig?.model ?? "veo-3.1-generate-preview",
				// Strict defaults required by schema
				resolution: "720p",
				durationSeconds: "7",
				aspectRatio: nodeConfig?.aspectRatio ?? "16:9",
				personGeneration: nodeConfig?.personGeneration ?? "allow_adult",
			},
		});

		useEffect(() => {
			if (node?.config) {
				// Ensure we reset with the strict values enforced
				const cfg = node.config as VideoGenExtendNodeConfig;
				form.reset({
					...cfg,
					resolution: "720p",
					durationSeconds: "7",
				});
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as VideoGenExtendNodeConfig;
				if (
					val.model !== nodeConfig?.model ||
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

					<div className="flex flex-col gap-4">
						<div className="flex gap-4">
							<div className="flex-1 opacity-60">
								<SelectField
									control={form.control}
									name="resolution"
									label="Resolution (Fixed)"
									placeholder="720p"
									options={["720p"]}
									disabled={true}
								/>
							</div>
							<div className="flex-1 opacity-60">
								<SelectField
									control={form.control}
									name="durationSeconds"
									label="Duration (Fixed)"
									placeholder="7"
									options={["7"]}
									disabled={true}
								/>
							</div>
						</div>
						<FormDescription>
							Video extension is currently limited to 720p and 7 seconds.
						</FormDescription>
					</div>
				</form>
			</Form>
		);
	},
);

export { VideoGenExtendNodeConfigComponent };
