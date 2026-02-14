import type { NodeEntityType } from "@gatewai/react-store";
import { useUploadFileNodeAssetMutation } from "@gatewai/react-store";
import { Loader2, UploadIcon } from "lucide-react";
import { useCallback } from "react";
import { type Accept, useDropzone } from "react-dropzone";
import type { UploadFileNodeAssetRPC } from "@/rpc/types";

interface DropzoneProps {
	className?: string;
	onUploadSuccess?: (resp: UploadFileNodeAssetRPC) => void;
	onUploadError?: (error: Error) => void;
	onUploadStart?: () => void;
	accept?: Accept;
	label?: string;
	nodeId: NodeEntityType["id"];
}

export const UploadDropzone = ({
	className,
	onUploadStart,
	onUploadSuccess,
	onUploadError,
	accept,
	label,
	nodeId,
}: DropzoneProps) => {
	const [upload, { isLoading }] = useUploadFileNodeAssetMutation();

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			if (acceptedFiles.length === 0) return;
			const file = acceptedFiles[0];
			try {
				onUploadStart?.();
				const asset = await upload({
					form: {
						file,
					},
					param: {
						nodeId,
					},
				}).unwrap();
				onUploadSuccess?.(asset);
			} catch (error) {
				console.error(error);
				if (error instanceof Error) {
					onUploadError?.(error);
				}
			}
		},
		[onUploadStart, upload, nodeId, onUploadSuccess, onUploadError],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		multiple: false,
		accept,
	});

	return (
		<div
			{...getRootProps()}
			className={`flex justify-center items-center border-2 border-dashed rounded-md p-4 text-xs cursor-pointer ${className ?? ""}`}
		>
			<input {...getInputProps()} />
			{isLoading ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Uploading...
				</>
			) : (
				<>
					<UploadIcon className="mr-2 h-4 w-4" />
					{isDragActive
						? "Drop the file here"
						: (label ?? "Click or drag & drop a file here")}
				</>
			)}
		</div>
	);
};
