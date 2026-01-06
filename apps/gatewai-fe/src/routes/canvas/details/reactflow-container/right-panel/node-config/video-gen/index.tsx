import {
	VIDEOGEN_ASPECT_RATIOS,
	VIDEOGEN_DURATIONS,
	VIDEOGEN_NODE_MODELS,
	VIDEOGEN_RESOLUTIONS,
	type VideoGenNodeConfig,
	VideoGenNodeConfigSchema,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Form, FormDescription } from "@/components/ui/form";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import { useAppSelector } from "@/store";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const VideoGenNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();

		const edges = useAppSelector(makeSelectEdgesByTargetNodeId(node.id));
		const handles = useAppSelector(makeSelectHandlesByNodeId(node.id));
		const hasReferenceImage = useMemo(() => {
			const imageHandle = handles.find(
				(f) => f.type === "Input" && f.dataTypes.includes("Image"),
			);
			return edges.find((f) => f.targetHandleId === imageHandle?.id) != null;
		}, [edges, handles]);

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
				resolution: nodeConfig?.resolution ?? "1080p",
				durationSeconds: nodeConfig?.durationSeconds ?? "8",
				personGeneration: nodeConfig?.personGeneration ?? "allow_all",
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

		useEffect(() => {
			const sub = form.watch((value, { name }) => {
				if (name === "durationSeconds" || name === "resolution") {
					const val = value as VideoGenNodeConfig;
					if (val.durationSeconds !== "8" && val.resolution === "1080p") {
						form.setValue("resolution", "720p", {
							shouldValidate: true,
							shouldDirty: true,
						});
					}
				}
			});
			return () => sub.unsubscribe();
		}, [form]);

		useEffect(() => {
			const sub = form.watch((value, { name }) => {
				if (name === "aspectRatio") {
					const val = value as VideoGenNodeConfig;
					if (hasReferenceImage && val.aspectRatio !== "16:9") {
						form.setValue("aspectRatio", "16:9", {
							shouldValidate: true,
							shouldDirty: true,
						});
					}
				}
			});
			return () => sub.unsubscribe();
		}, [form, hasReferenceImage]);

		useEffect(() => {
			if (hasReferenceImage && form.getValues("aspectRatio") !== "16:9") {
				form.setValue("aspectRatio", "16:9", {
					shouldValidate: true,
					shouldDirty: true,
				});
			}
		}, [hasReferenceImage, form]);

		const resolution = form.watch("resolution");
		const durationSeconds = form.watch("durationSeconds");

		const resolutionOptions =
			durationSeconds === "8" ? VIDEOGEN_RESOLUTIONS : ["720p" as const];

		const durationOptions =
			resolution === "1080p" ? ["8" as const] : VIDEOGEN_DURATIONS;

		const aspectRatioField = (
			<SelectField
				control={form.control}
				name="aspectRatio"
				label="Aspect Ratio"
				placeholder="Select aspect ratio"
				options={VIDEOGEN_ASPECT_RATIOS}
				disabled={hasReferenceImage}
			/>
		);

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
						{hasReferenceImage ? (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div>{aspectRatioField}</div>
									</TooltipTrigger>
									<TooltipContent>
										<p>
											When using a reference image, aspect ratio is fixed to
											16:9.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : (
							aspectRatioField
						)}
					</div>
					<div className="flex flex-col gap-4">
						<div className="flex-1">
							<SelectField
								control={form.control}
								name="resolution"
								label="Resolution"
								placeholder="Select resolution"
								options={resolutionOptions}
							/>
							<FormDescription>
								1080p is only available for 8-second videos.
							</FormDescription>
						</div>
						<div className="flex-1">
							<SelectField
								control={form.control}
								name="durationSeconds"
								label="Duration (seconds)"
								placeholder="Select duration"
								options={durationOptions}
							/>
							<FormDescription>
								1080p requires exactly 8 seconds.
							</FormDescription>
						</div>
					</div>
				</form>
			</Form>
		);
	},
);

export { VideoGenNodeConfigComponent };
