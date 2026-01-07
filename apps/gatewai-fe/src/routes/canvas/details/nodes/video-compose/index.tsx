import type { FileData } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { Download, Loader2, VideoIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { useDownloadFileData } from "../../hooks/use-download-filedata";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { VideoRenderer } from "../common/video-renderer";
import type { CompositorNode } from "../node-props";

const VideoCompositorNodeComponent = memo(
	(props: NodeProps<CompositorNode>) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const [isDownloading, setIsDownloading] = useState(false);
		const { result, isProcessing } = useNodeResult(props.id);
		const nav = useNavigate();

		const videoSrc = useMemo(() => {
			const output = result?.outputs[result.selectedOutputIndex];
			const outputItem = output?.items[0].data as FileData;
			return outputItem?.processData?.dataUrl;
		}, [result]);

		const downloadFileData = useDownloadFileData();

		/**
		 * Main download handler
		 */
		const onClickDownload = async () => {
			if (!result) {
				toast.error("No result available to download");
				return;
			}

			try {
				// Get the selected output
				const selectedOutput = result.outputs[result.selectedOutputIndex];

				if (!selectedOutput || !selectedOutput.items.length) {
					throw new Error("No output items found");
				}

				// Get the first item (primary output)
				const outputItem = selectedOutput.items[0];
				const { type, data } = outputItem;

				await downloadFileData(data as FileData, type);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "An unknown error occurred";
				toast.error(errorMessage);
				console.error("Download failed:", err);
			} finally {
				setIsDownloading(false);
			}
		};

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					<div
						className={cn(
							"w-full overflow-hidden rounded media-container relative",
							{
								"h-48": !videoSrc,
							},
						)}
					>
						{videoSrc && <VideoRenderer src={videoSrc} />}
					</div>
					<div className="flex justify-between items-center">
						<AddCustomHandleButton
							dataTypes={["Video", "Audio", "Image", "Text"]}
							nodeProps={props}
							type="Input"
						/>
						{node && (
							<div className="flex gap-2">
								<Button
									onClick={onClickDownload}
									variant="ghost"
									disabled={isProcessing || isDownloading}
									size="sm"
								>
									{isDownloading && (
										<>
											<Loader2 className="size-3 mr-2 animate-spin" />
											Downloading...
										</>
									)}
									{isProcessing && (
										<>
											<Loader2 className="size-3 mr-2 animate-spin" />
											Rendering...
										</>
									)}
									{!isDownloading && !isProcessing && (
										<>
											<Download className="size-3 mr-2" />
											Download
										</>
									)}
								</Button>
								<Button
									onClick={() => nav(`video-editor/${node.id}`)}
									size="sm"
								>
									<VideoIcon /> Edit
								</Button>
							</div>
						)}
					</div>
				</div>
			</BaseNode>
		);
	},
);

VideoCompositorNodeComponent.displayName = "VideoCompositorNodeComponent";

export { VideoCompositorNodeComponent };
