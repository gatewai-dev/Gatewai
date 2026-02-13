import { DATA_TYPE_EXTENSIONS, type FileData } from "@gatewai/core/types";
import type { DataType } from "@gatewai/db";
import { GetAssetEndpoint, extractExtension } from "@gatewai/core/browser";

class DownloadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DownloadError";
	}
}
/**
 * Generate filename based on context
 */
const generateFilename = (
	dataType: DataType,
	fileData?: FileData,
	id?: string,
): string => {
	const timestamp = Date.now();
	let extension = DATA_TYPE_EXTENSIONS[dataType];
	// Try to get extension from entity
	if (fileData?.entity?.name) {
		const entityExt = fileData.entity.name.split(".").pop();
		if (entityExt && entityExt !== fileData.entity.name) {
			extension = entityExt;
		}
	}

	// Try to get extension from dataUrl
	if (fileData?.processData?.dataUrl) {
		const urlExt = extractExtension(fileData.processData?.dataUrl);
		if (urlExt) {
			extension = urlExt;
		}
	}

	return `export-${fileData?.entity?.name ?? id ?? ""}-${timestamp}.${extension}`;
};

function useDownloadFileData() {
	return async (fileData: FileData, dataType: DataType) => {
		let url: string | undefined;
		let filename: string;
		let shouldRevokeUrl = false;

		try {
			// Priority 1: Use dataUrl if available
			if (fileData.processData?.dataUrl) {
				url = fileData.processData?.dataUrl;
				filename = generateFilename(dataType, fileData);

				// If it's a base64 data URL, we can use it directly
				// Otherwise, we might need to fetch it
				if (!url.startsWith("data:")) {
					// For HTTP URLs, fetch and create blob for better download support
					const response = await fetch(url);
					if (!response.ok) {
						throw new DownloadError(
							`Failed to fetch file: ${response.statusText}`,
						);
					}
					const blob = await response.blob();
					url = URL.createObjectURL(blob);
					shouldRevokeUrl = true;
				}
			}
			// Priority 2: Use entity URL/path
			else if (fileData.entity) {
				const entity = fileData.entity;
				url = GetAssetEndpoint(entity);
				filename = entity.name || generateFilename(dataType, fileData);

				if (!url) {
					throw new DownloadError("No valid URL found in file entity");
				}

				// Fetch and create blob for consistent download behavior
				const response = await fetch(url);
				if (!response.ok) {
					throw new DownloadError(
						`Failed to fetch file: ${response.statusText}`,
					);
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
				setTimeout(() => {
					if (url) {
						URL.revokeObjectURL(url);
					}
				}, 100);
			}
		} catch (err) {
			throw new DownloadError(
				`Failed to download file: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	};
}

export { useDownloadFileData };
