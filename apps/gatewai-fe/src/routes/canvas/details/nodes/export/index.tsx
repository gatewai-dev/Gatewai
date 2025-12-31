import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { BlurNode } from "../node-props";
import { Button } from "@/components/ui/button";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { InfoIcon, Download, Loader2, AlertCircle } from "lucide-react";
import { AlertDescription, Alert } from "@/components/ui/alert";
import type { DataType } from "@gatewai/db";
import type { FileData } from "@gatewai/types";
import { GetAssetEndpoint } from "@/utils/file";

function ExportNodeHandbook() {
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
                            <p className="mb-2">
                                Connect a node and export (download) the result as a file.
                            </p>

                            <h2 className="font-semibold mt-3 mb-1">API Requests</h2>
                            <p className="mb-1">
                                When you run the workflow via API request, export node will put the output inside "data".
                            </p>
                            <code className="block bg-muted p-2 rounded text-[7px] mt-1">
                                {`{ "[Node ID]": "[FileData/Text/base64]" }`}
                            </code>
                        </AlertDescription>
                    </Alert>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

// Type guards
const isFileData = (data: unknown): data is FileData => {
    return (
        typeof data === "object" &&
        data !== null &&
        ("dataUrl" in data || "entity" in data)
    );
};

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    pdf: "application/pdf",
    json: "application/json",
    txt: "text/plain",
};

// File extension mapping for data types
const DATA_TYPE_EXTENSIONS: Record<DataType, string> = {
    Image: "png",
    Video: "mp4",
    Audio: "mp3",
    File: "bin",
    Mask: "png",
    Text: "txt",
    Number: "txt",
    Boolean: "txt",
};

class DownloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DownloadError";
    }
}

const ExportNodeComponent = memo((props: NodeProps<BlurNode>) => {
    const {result} = useNodeResult(props.id);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Extract file extension from URL or data URL
     */
    const extractExtension = (url: string): string | null => {
        try {
            // Handle data URLs
            if (url.startsWith("data:")) {
                const match = url.match(/data:([^;]+)/);
                if (match) {
                    const mimeType = match[1];
                    // Find extension from MIME type
                    const entry = Object.entries(MIME_TYPES).find(
                        ([_, mime]) => mime === mimeType
                    );
                    return entry?.[0] || null;
                }
            }

            // Handle regular URLs
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
            return match?.[1] || null;
        } catch {
            return null;
        }
    };

    /**
     * Generate filename based on context
     */
    const generateFilename = (
        dataType: DataType,
        fileData?: FileData
    ): string => {
        const timestamp = Date.now();
        let extension = DATA_TYPE_EXTENSIONS[dataType] || "bin";

        // Try to get extension from entity
        if (fileData?.entity?.name) {
            const entityExt = fileData.entity.name.split(".").pop();
            if (entityExt && entityExt !== fileData.entity.name) {
                extension = entityExt;
            }
        }

        // Try to get extension from dataUrl
        if (fileData?.dataUrl) {
            const urlExt = extractExtension(fileData.dataUrl);
            if (urlExt) {
                extension = urlExt;
            }
        }

        return `export-${props.id}-${timestamp}.${extension}`;
    };

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
            throw new DownloadError(
                `Failed to download text file: ${err instanceof Error ? err.message : "Unknown error"}`
            );
        }
    };

    /**
     * Download FileData (handles both dataUrl and entity cases)
     */
    const downloadFileData = async (
        fileData: FileData,
        dataType: DataType
    ) => {
        let url: string | undefined;
        let filename: string;
        let shouldRevokeUrl = false;

        try {
            // Priority 1: Use dataUrl if available
            if (fileData.dataUrl) {
                url = fileData.dataUrl;
                filename = generateFilename(dataType, fileData);

                // If it's a base64 data URL, we can use it directly
                // Otherwise, we might need to fetch it
                if (!url.startsWith("data:")) {
                    // For HTTP URLs, fetch and create blob for better download support
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new DownloadError(`Failed to fetch file: ${response.statusText}`);
                    }
                    const blob = await response.blob();
                    url = URL.createObjectURL(blob);
                    shouldRevokeUrl = true;
                }
            }
            // Priority 2: Use entity URL/path
            else if (fileData.entity) {
                const entity = fileData.entity;
                url = GetAssetEndpoint(entity.id);
                filename = entity.name || generateFilename(dataType, fileData);

                if (!url) {
                    throw new DownloadError("No valid URL found in file entity");
                }

                // Fetch and create blob for consistent download behavior
                const response = await fetch(url);
                if (!response.ok) {
                    throw new DownloadError(`Failed to fetch file: ${response.statusText}`);
                }
                const blob = await response.blob();
                url = URL.createObjectURL(blob);
                shouldRevokeUrl = true;
            } else {
                throw new DownloadError("No dataUrl or entity found in FileData");
            }

            if (!url) {
                throw new DownloadError("Unable to determine download URL");
            }

            // Trigger download
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.style.display = "none";
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Cleanup
            if (shouldRevokeUrl) {
                setTimeout(() => URL.revokeObjectURL(url!), 100);
            }
        } catch (err) {
            throw new DownloadError(
                `Failed to download file: ${err instanceof Error ? err.message : "Unknown error"}`
            );
        }
    };

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
                throw new DownloadError("No output items found");
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
                throw new DownloadError(`Unsupported data type: ${type}`);
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

    const hasResult = result && result.outputs[result.selectedOutputIndex]?.items.length > 0;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3">
                <ExportNodeHandbook />
                
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="size-3" />
                        <AlertDescription className="text-[8px]">
                            {error}
                        </AlertDescription>
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