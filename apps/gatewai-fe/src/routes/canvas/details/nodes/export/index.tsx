import type { NodeProps } from "@xyflow/react";
import { AlertCircle, Download, InfoIcon, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { NodeEntityType } from "@/store/nodes";
import { isFileData } from "@/utils/file";
import { useNodeResult } from "../../graph-engine/processor-ctx";
import { useDownloadFileData } from "../../hooks/use-download-filedata";
import { BaseNode } from "../base";
import type { BlurNode } from "../node-props";

function ExportNodeHandbook({ nodeId }: { nodeId: NodeEntityType["id"] }) {
	return (
		<Accordion type="single" collapsible defaultValue="info">
			<AccordionItem value="info">
				<AccordionTrigger className="text-[8px] py-2 gap-1 flex justify-start items-center">
					<InfoIcon className="size-2" />
					Handbook
				</AccordionTrigger>
				<AccordionContent>
					<Alert>
						<InfoIcon className="size-3" />
						<AlertDescription className="text-[8px]">
							<p className="mb-2">Connect a node and click Download button.</p>
							<Separator />
							<h2 className="font-semibold mt-3 mb-1">API Requests</h2>
							<p className="mb-1">
								When you run the workflow via API request, export node will
								expose the output.
							</p>
							<code className="block bg-muted p-2 rounded text-[7px] mt-1 whitespace-pre-wrap w-full">
								{`{
	...
	"data": {
		"${nodeId}": [data]
	}
}`}
							</code>
						</AlertDescription>
					</Alert>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

const ExportNodeComponent = memo((props: NodeProps<BlurNode>) => {
	const { result } = useNodeResult(props.id);
	const [isDownloading, setIsDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Download primitive types as text file
	 */
	const downloadAsText = async (content: string, filename: string) => {
		try {
			const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
			const url = URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.style.display = "none";

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			// Cleanup
			setTimeout(() => URL.revokeObjectURL(url), 100);
		} catch (err) {
			throw new Error(
				`Failed to download text file: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	};

	const downloadFileData = useDownloadFileData();

	/**
	 * Main download handler
	 */
	const onClickDownload = async () => {
		if (!result) {
			setError("No result available to download");
			return;
		}

		setIsDownloading(true);
		setError(null);

		try {
			// Get the selected output
			const selectedOutput = result.outputs[result.selectedOutputIndex];

			if (!selectedOutput || !selectedOutput.items.length) {
				throw new Error("No output items found");
			}

			// Get the first item (primary output)
			const outputItem = selectedOutput.items[0];
			const { type, data } = outputItem;

			// Handle different data types
			if (type === "Text" || type === "Number" || type === "Boolean") {
				const content = String(data);
				const filename = `export-${props.id}-${Date.now()}.txt`;
				await downloadAsText(content, filename);
			} else if (isFileData(data)) {
				await downloadFileData(data, type);
			} else {
				throw new Error(`Unsupported data type: ${type}`);
			}

			setError(null);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An unknown error occurred";
			setError(errorMessage);
			console.error("Download failed:", err);
		} finally {
			setIsDownloading(false);
		}
	};

	const hasResult =
		result && result.outputs[result.selectedOutputIndex]?.items.length > 0;

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3">
				<ExportNodeHandbook nodeId={props.id} />

				{error && (
					<Alert variant="destructive">
						<AlertCircle className="size-3" />
						<AlertDescription className="text-[8px]">{error}</AlertDescription>
					</Alert>
				)}

				<Button
					onClick={onClickDownload}
					variant="default"
					disabled={!hasResult || isDownloading}
					className="w-full"
				>
					{isDownloading ? (
						<>
							<Loader2 className="size-3 mr-2 animate-spin" />
							Downloading...
						</>
					) : (
						<>
							<Download className="size-3 mr-2" />
							Download
						</>
					)}
				</Button>

				{!hasResult && !error && (
					<p className="text-[8px] text-muted-foreground text-center">
						Connect a node to enable download
					</p>
				)}
			</div>
		</BaseNode>
	);
});

ExportNodeComponent.displayName = "ExportNodeComponent";

export { ExportNodeComponent };
