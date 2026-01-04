import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_PERSON_GENERATION_OPTIONS,
	type VideoGenExtendNodeConfig,
	VideoGenExtendNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
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
				model: nodeConfig?.model ?? VIDEOGEN_NODE_MODELS[0],
				aspectRatio: nodeConfig?.aspectRatio ?? "16:9",
				resolution: "720p", // Fixed per schema and docs
				durationSeconds: "8", // Fixed per schema and docs
				personGeneration: nodeConfig?.personGeneration ?? "allow_all", // Restricted to allow_all per docs for extension
			},
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(node.config as VideoGenExtendNodeConfig);
			}
		}, [node, form]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = value as VideoGenExtendNodeConfig;
				if (
					val.model !== nodeConfig?.model ||
					val.aspectRatio !== nodeConfig?.aspectRatio ||
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
					<SelectField
						control={form.control}
						name="aspectRatio"
						label="Aspect Ratio"
						placeholder="Select aspect ratio"
						options={VIDEOGEN_ASPECT_RATIOS}
					/>
					<SelectField
						control={form.control}
						name="personGeneration"
						label="Person Generation"
						placeholder="Select person generation option"
						options={["allow_all"]} // Restricted per docs for extension
					/>
				</form>
			</Form>
		);
	},
);

export { VideoGenExtendNodeConfigComponent };
