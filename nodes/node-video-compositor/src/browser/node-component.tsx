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

import { Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { VideoCompositorNodeConfig } from "../shared/config.js";
import { remotionService } from "./muxer-service.js";

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
			const result = await remotionService.processVideo(config, inputs);
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
