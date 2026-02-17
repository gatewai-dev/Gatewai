import { ENV_CONFIG, generateId } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { StorageService } from "@gatewai/core/storage";
import type { FileResult, MediaService } from "@gatewai/core/types";
import { type DataType, prisma } from "@gatewai/db";
import { fileTypeFromBuffer } from "file-type";
import { getMediaDuration } from "./utils/index.js";

interface UploadOptions {
	nodeId: string;
	buffer: Buffer;
	filename: string;
	mimeType?: string;
}

/**
 * Uploads a buffer to GCS, creates a FileAsset, and updates the Node's output handles.
 */
export async function uploadToImportNode({
	nodeId,
	buffer,
	filename,
	mimeType,
}: UploadOptions) {
	// 1. Fetch Node and validate existence
	const node = await prisma.node.findUnique({
		where: { id: nodeId },
		include: {
			canvas: true,
			handles: {
				where: { type: "Output" },
				orderBy: { order: "asc" },
			},
		},
	});

	if (!node) {
		throw new Error(`Node with id ${nodeId} not found`);
	}

	// 2. Determine Content Type
	let contentType = mimeType;
	if (!contentType) {
		const fileTypeResult = await fileTypeFromBuffer(buffer);
		contentType = fileTypeResult?.mime ?? "application/octet-stream";
	}

	// Ensure contentType is a string
	const finalContentType = contentType || "application/octet-stream";

	// 3. Extract Metadata (Dimensions or Duration)
	let width: number | null = null;
	let height: number | null = null;
	let durationInSec: number | null = null;

	if (finalContentType.startsWith("image/")) {
		try {
			const media = container.resolve<MediaService>(TOKENS.MEDIA);
			const metadata = await media.getImageDimensions(buffer);
			width = metadata.width || null;
			height = metadata.height || null;
		} catch (error) {
			console.error("Failed to compute image metadata:", error);
		}
	} else if (
		finalContentType.startsWith("video/") ||
		finalContentType.startsWith("audio/")
	) {
		try {
			durationInSec = await getMediaDuration(buffer);
		} catch (error) {
			console.error("Failed to compute media duration:", error);
		}
	}

	// 4. Upload to Storage
	const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET ?? "default-bucket";
	const key = `assets/${generateId()}-${filename}`;

	const storage = container.resolve<StorageService>(TOKENS.STORAGE);
	await storage.uploadToStorage(buffer, key, finalContentType, bucket);

	const expiresIn = 3600 * 24 * 6.9; // ~1 week
	const signedUrl = await storage.generateSignedUrl(key, bucket, expiresIn);
	const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

	// 5. Create Asset Record
	const asset = await prisma.fileAsset.create({
		data: {
			name: filename,
			userId: node.canvas.userId,
			bucket,
			key,
			signedUrl,
			isUploaded: true,
			duration: durationInSec ? Math.round(durationInSec * 1000) : undefined,
			size: buffer.length,
			signedUrlExp,
			width,
			height,
			mimeType: finalContentType,
		},
	});

	// 6. Update Node Config
	// We store the single asset in config.asset
	// If the user uploads a new file, it replaces the old one.

	const currentConfig = (node.config as any) || {};
	const updatedConfig = {
		...currentConfig,
		asset,
	};

	const updatedNode = await prisma.node.update({
		where: { id: nodeId },
		data: { config: updatedConfig },
		include: {
			handles: true,
		},
	});

	return updatedNode;
}
