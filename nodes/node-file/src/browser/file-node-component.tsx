import type { FileResult } from "@gatewai/core/types";
import {
	BaseNode,
	MediaContent,
	UploadButton,
	UploadDropzone,
	useHasOutputItems,
} from "@gatewai/react-canvas";
import {
	makeSelectNodeById,
	type UploadFileNodeAssetRPC,
	updateNodeResult,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { toast } from "sonner";

type SuccessfulUploadFileNodeAssetRPC = Extract<
	UploadFileNodeAssetRPC,
	{ handles: unknown } | { someOtherSuccessProperty: unknown }
>;

const FileNodeComponent = memo((props: NodeProps) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const showResult = useHasOutputItems(node);
	const dispatch = useAppDispatch();

	const result = node?.result as unknown as FileResult;

	const existingMimeType =
		result?.outputs?.[0]?.items?.[0]?.data?.entity?.mimeType;

	const existingType = existingMimeType?.startsWith("image/")
		? "image"
		: existingMimeType?.startsWith("video/")
			? "video"
			: existingMimeType?.startsWith("audio/")
				? "audio"
				: null;

	const accept = {
		"image/jpeg": [".jpg", ".jpeg"],
		"image/png": [".png"],
		"image/webp": [".webp"],
		"video/mp4": [".mp4"],
		"video/quicktime": [".mov"],
		"video/webm": [".webm"],
		"audio/mpeg": [".mp3"],
		"audio/wav": [".wav"],
		"audio/ogg": [".ogg"],
		"audio/aac": [".aac"],
		"audio/flac": [".flac"],
	};

	const getFilteredAccept = (type: "image" | "video" | "audio" | null) => {
		const keys = Object.keys(accept);
		if (!type) return keys;
		return keys.filter((mime) => mime.startsWith(`${type}/`));
	};

	const buttonAccept = getFilteredAccept(existingType);

	const buttonLabel =
		showResult && existingType
			? `Upload another ${existingType}`
			: "Click to upload a file";

	const dropzoneLabel =
		"Click or drag & drop an image, video, or audio file here";

	const onUploadSuccess = (uploadResult: UploadFileNodeAssetRPC) => {
		if (Object.hasOwn(uploadResult, "error")) {
			const errorResult = uploadResult as { error: string };
			console.error("Upload failed:", errorResult.error);
			toast.error(
				"An error occurred when uploading file, please try again later.",
			);
			return;
		}
		const successResult = uploadResult as SuccessfulUploadFileNodeAssetRPC;
		dispatch(
			updateNodeResult({
				id: props.id,
				newResult: successResult.result as unknown as FileResult,
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
			<div className="flex flex-col gap-2">
				{showResult && <MediaContent node={node} result={result} />}
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
						className="py-0"
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

export { FileNodeComponent };
