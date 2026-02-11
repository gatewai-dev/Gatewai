import type { NodeEntityType } from "@gatewai/react-store";
import { useUploadFileNodeAssetMutation } from "@gatewai/react-store";
import { Button } from "@gatewai/ui-kit";
import { Loader2, PlusIcon } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { UploadFileNodeAssetRPC } from "@/rpc/types";

interface UploadButtonProps {
	className?: string;
	onUploadSuccess?: (resp: UploadFileNodeAssetRPC) => void;
	onUploadError?: (error: Error) => void;
	onUploadStart?: () => void;
	accept?: string[];
	label?: string;
	nodeId: NodeEntityType["id"];
}

export const UploadButton = ({
	className,
	onUploadStart,
	onUploadSuccess,
	onUploadError,
	accept,
	label,
	nodeId,
}: UploadButtonProps) => {
	const [upload, { isLoading }] = useUploadFileNodeAssetMutation();
	const inputRef = useRef<HTMLInputElement>(null);

	const handleClick = () => {
		if (!isLoading) {
			inputRef.current?.click();
		}
	};

	const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			onUploadStart?.();
			const resp = await upload({
				form: {
					file,
				},
				param: {
					nodeId,
				},
			}).unwrap();
			onUploadSuccess?.(resp);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				onUploadError?.(error);
			}
		}
		e.target.value = "";
	};

	return (
		<>
			<Button
				onClick={handleClick}
				disabled={isLoading}
				variant="ghost"
				size="xs"
				className={cn(className)}
			>
				{isLoading ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" />
						Uploading...
					</>
				) : (
					<>
						<PlusIcon className="h-3 w-3" />
						{label ?? "Click to upload a file"}
					</>
				)}
			</Button>
			<input
				type="file"
				ref={inputRef}
				onChange={handleChange}
				style={{ display: "none" }}
				multiple={false}
				accept={accept?.join(",")}
			/>
		</>
	);
};
