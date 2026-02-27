import {
	BaseNode,
	MediaContent,
	useHasOutputItems,
} from "@gatewai/react-canvas";
import type { UploadFileNodeAssetRPC } from "@gatewai/react-store";
import {
	makeSelectNodeById,
	updateNodeResult,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { toast } from "sonner";
import type { ImportResult } from "../shared/index.js";
import { UploadButton } from "./file-button.js";
import { UploadDropzone } from "./file-dropzone.js";

const ImportNodeComponent = memo((props: NodeProps) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const showResult = useHasOutputItems(node);
	const dispatch = useAppDispatch();

	const result = node?.result as unknown as ImportResult;
	const item = result?.outputs?.[0]?.items?.[0];

	// Robust mimeType extraction: handle both VirtualMediaData and FileData
	const itemData = item?.data as any;
	const existingMimeType =
		itemData?.source?.entity?.mimeType ??
		itemData?.source?.processData?.mimeType ??
		itemData?.entity?.mimeType ??
		itemData?.processData?.mimeType;

	const existingType =
		item?.type === "SVG"
			? "svg"
			: item?.type === "Image"
				? "image"
				: item?.type === "Video"
					? "video"
					: item?.type === "Audio"
						? "audio"
						: item?.type === "Lottie"
							? "lottie"
							: item?.type === "Caption"
								? "caption"
								: existingMimeType === "image/svg+xml"
									? "svg"
									: existingMimeType?.startsWith("image/")
										? "image"
										: existingMimeType?.startsWith("video/")
											? "video"
											: existingMimeType?.startsWith("audio/")
												? "audio"
												: existingMimeType === "application/json"
													? "lottie"
													: existingMimeType === "text/srt"
														? "caption"
														: null;

	const accept = {
		"image/jpeg": [".jpg", ".jpeg"],
		"image/png": [".png"],
		"image/webp": [".webp"],
		"image/svg+xml": [".svg"],
		"video/mp4": [".mp4"],
		"video/quicktime": [".mov"],
		"video/webm": [".webm"],
		"audio/mpeg": [".mp3"],
		"audio/wav": [".wav"],
		"audio/ogg": [".ogg"],
		"audio/aac": [".aac"],
		"audio/flac": [".flac"],
		"application/json": [".json", ".lottie"],
		"text/srt": [".srt"],
	};

	const getFilteredAccept = (
		type: "image" | "video" | "audio" | "lottie" | "svg" | "caption" | null,
	) => {
		if (!type) return Object.keys(accept);

		if (type === "lottie") return ["application/json", ".json", ".lottie"];
		if (type === "svg") return ["image/svg+xml", ".svg"];
		if (type === "caption") return ["text/srt", ".srt"];

		const keys = Object.keys(accept);
		const filteredMimes = keys.filter((mime) => mime.startsWith(`${type}/`));

		// Include both mimes and their associated extensions
		const extensions = filteredMimes.flatMap(
			(mime) => accept[mime as keyof typeof accept] || [],
		);

		return [...filteredMimes, ...extensions];
	};

	const buttonAccept = getFilteredAccept(existingType as any);

	const displayType = existingType;

	const buttonLabel =
		showResult && existingType
			? `Upload another ${displayType}`
			: "Click to upload a file";

	const dropzoneLabel =
		"Click or drag & drop an image, SVG, video, audio, Lottie, or SRT file here";

	const onUploadSuccess = (uploadResult: UploadFileNodeAssetRPC) => {
		if (Object.hasOwn(uploadResult, "error")) {
			const errorResult = uploadResult as { error: string };
			console.error("Upload failed:", errorResult.error);
			toast.error(
				"An error occurred when uploading file, please try again later.",
			);
			return;
		}
		const successResult = uploadResult;
		dispatch(
			updateNodeResult({
				id: props.id,
				newResult: successResult.result as any,
			}),
		);
	};

	const onUploadError = (error: Error) => {
		console.error("Upload failed:", error);
		toast.error(
			"An error occurred when uploading file, please try again later.",
		);
	};

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col w-full">
				{showResult && node && <MediaContent node={node} />}
				{!showResult && (
					<UploadDropzone
						className="w-full py-16"
						onUploadSuccess={onUploadSuccess}
						onUploadError={onUploadError}
						accept={accept}
						nodeId={props.id}
						label={dropzoneLabel}
					/>
				)}
				{showResult && (
					<UploadButton
						className="h-5 m-1.5"
						onUploadSuccess={onUploadSuccess}
						onUploadError={onUploadError}
						accept={buttonAccept}
						label={buttonLabel}
						nodeId={props.id}
					/>
				)}
			</div>
		</BaseNode>
	);
});

export { ImportNodeComponent };
