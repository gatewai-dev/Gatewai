import { ENV_CONFIG, generateId } from "@gatewai/core";
import { container } from "@gatewai/core/di";
import type {
	FileResult,
	MediaService,
	StorageService,
} from "@gatewai/core/types";
import { type DataType, prisma } from "@gatewai/db";
import { getMediaDuration } from "@gatewai/media";
import { TOKENS } from "@gatewai/node-sdk";
import { fileTypeFromBuffer } from "file-type";

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

	// 3. Extract Metadata (Dimensions or Duration)
	let width: number | null = null;
	let height: number | null = null;
	let durationInSec: number | null = null;

	if (contentType.startsWith("image/")) {
		try {
			const media = container.resolve<MediaService>(TOKENS.MEDIA);
			const metadata = await media.getImageDimensions(buffer);
			width = metadata.width || null;
			height = metadata.height || null;
		} catch (error) {
			console.error("Failed to compute image metadata:", error);
		}
	} else if (
		contentType.startsWith("video/") ||
		contentType.startsWith("audio/")
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
	await storage.uploadToGCS(buffer, key, contentType, bucket);

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
			mimeType: contentType,
		},
	});

	// 6. Update Node Result & Handles
	const currentResult = (node.result as unknown as FileResult) || {
		outputs: [],
	};
	const outputs = currentResult.outputs || [];
	const newIndex = outputs.length;

	const outputHandle = node.handles[0];
	if (!outputHandle) {
		throw new Error("No output handle found for node");
	}

	let dataType: DataType;
	if (contentType.startsWith("image/")) {
		dataType = "Image";
	} else if (contentType.startsWith("video/")) {
		dataType = "Video";
	} else if (contentType.startsWith("audio/")) {
		dataType = "Audio";
	} else {
		throw new Error(`Invalid content type for Import Node: ${contentType}`);
	}

	const newOutput = {
		items: [
			{
				outputHandleId: outputHandle.id,
				data: {
					entity: asset,
				},
				type: dataType,
			},
		],
	};

	const updatedResult = {
		...currentResult,
		selectedOutputIndex: newIndex,
		outputs: [...outputs, newOutput],
	};

	const updatedNode = await prisma.node.update({
		where: { id: nodeId },
		data: { result: updatedResult },
		include: {
			handles: true,
		},
	});

	return updatedNode;
}
