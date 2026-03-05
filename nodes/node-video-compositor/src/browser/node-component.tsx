import type { FileData } from "@gatewai/core/types";
import {
	AddCustomHandleButton,
	BaseNode,
	MediaContent,
	type NodeProps,
	useDownloadFileData,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { Button } from "@gatewai/ui-kit";

import { AlertCircle, Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { remotionWebRendererService } from "./muxer-service.js";

const VideoCompositorNodeComponent = memo((props: NodeProps) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const nodeConfig = node?.config as VideoCompositorNodeConfig | undefined;
	const [isDownloading, setIsDownloading] = useState(false);
	const { inputs, result } = useNodeResult(props.id);
	const nav = useNavigate();
	const downloadFileData = useDownloadFileData();
	const onClickDownload = async () => {
		setIsDownloading(true);
		try {
			const config = nodeConfig ?? {
				layerUpdates: {},
				width: 1080,
				height: 1080,
			};
			const result = await remotionWebRendererService.processVideo(
				config,
				inputs,
			);
			await downloadFileData(
				{
					processData: {
						dataUrl: result.dataUrl,
					},
				} as FileData,
				"Video",
			);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An unknown error occurred";
			toast.error(errorMessage);
			console.error("Download failed:", err);
		} finally {
			setIsDownloading(false);
		}
	};

	const hasInputs = inputs.length > 0;

	const isSVGConnected = useMemo(() => {
		return Object.values(inputs).some(
			(input) => input.outputItem?.type === "SVG",
		);
	}, [inputs]);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col w-full">
				<div
					className="relative"
					style={{
						minHeight: hasInputs ? "120px" : "120px",
					}}
				>
					{result && node ? (
						<MediaContent node={node} />
					) : (
						<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs italic border-b border-white/10 w-full h-full">
							No input connected
						</div>
					)}
				</div>

				{isSVGConnected && (
					<div className="mx-2 mt-1 mb-0.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
						<AlertCircle className="size-3.5 text-amber-500 shrink-0" />
						<span className="text-[11px] font-medium text-amber-200/80 leading-tight">
							Rendering Animated SVG's doesn't work well
						</span>
					</div>
				)}

				<div className="flex justify-between items-center gap-2  p-1.5">
					<AddCustomHandleButton
						dataTypes={node?.template.variableInputDataTypes}
						nodeId={props.id}
						type="Input"
					/>
					{node && (
						<div className="flex gap-2 shrink-0">
							<Button
								onClick={onClickDownload}
								variant="ghost"
								disabled={isDownloading}
								size="sm"
							>
								{isDownloading ? (
									<>
										<Loader2 className="size-3 mr-1 animate-spin" />
										Rendering...
									</>
								) : (
									<>
										<Download className="size-3 mr-1" />
										Download
									</>
								)}
							</Button>
							<Button onClick={() => nav(`view/${node.id}`)} size="sm">
								<VideoIcon className="size-4 mr-1" /> Editor
							</Button>
						</div>
					)}
				</div>
			</div>
		</BaseNode>
	);
});

export { VideoCompositorNodeComponent };
