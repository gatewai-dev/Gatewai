import { ENV_CONFIG, extractSvgDimensions, generateId } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { StorageService } from "@gatewai/core/storage";
import type { MediaService } from "@gatewai/core/types";
import { type DataType, prisma } from "@gatewai/db";
import { createVirtualMedia } from "@gatewai/remotion-compositions/server";
import { fileTypeFromBuffer } from "file-type";
import { getMediaDuration, getVideoMetadata } from "./utils/index.js";

interface UploadOptions {
	nodeId: string;
	buffer: Buffer;
	filename: string;
	mimeType?: string;
}

type SupportedDataType = Extract<
	DataType,
	"Image" | "Video" | "Audio" | "SVG" | "Caption"
>;

function extractCaptionDuration(buffer: Buffer): number | null {
	try {
		const str = buffer.toString("utf-8");
		const regex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
		let maxTimeSec = 0;
		let match;
		while ((match = regex.exec(str)) !== null) {
			const hours = parseInt(match[1], 10);
			const minutes = parseInt(match[2], 10);
			const seconds = parseInt(match[3], 10);
			const ms = parseInt(match[4], 10);
			const timeSec = hours * 3600 + minutes * 60 + seconds + ms / 1000;
			if (timeSec > maxTimeSec) {
				maxTimeSec = timeSec;
			}
		}
		return maxTimeSec > 0 ? maxTimeSec : null;
	} catch {
		return null;
	}
}

function resolveDataType(
	contentType: string,
	filename: string,
): SupportedDataType {
	if (contentType === "image/svg+xml") return "SVG";
	if (contentType.startsWith("image/")) return "Image";
	if (contentType.startsWith("video/")) return "Video";
	if (contentType.startsWith("audio/")) return "Audio";

	const ext = filename.toLowerCase().split(".").pop();
	if (ext === "srt") {
		return "Caption";
	}

	if (contentType === "text/srt") return "Caption";

	throw new Error(`Unsupported content type for Import Node: ${contentType}`);
}

/**
 * Uploads a buffer to GCS, creates a FileAsset record, and appends an output
 * entry to the node's result.
 *
 * Ordering guarantees:
 * 1. Storage upload happens first — no DB rows are written if this fails.
 * 2. FileAsset creation and node update are wrapped in a transaction —
 * failure leaves no orphaned asset records.
 */
export async function uploadToImportNode({
	nodeId,
	buffer,
	filename,
	mimeType,
}: UploadOptions): Promise<Awaited<ReturnType<typeof prisma.node.update>>> {
	if (!buffer.length) {
		throw new Error("Upload buffer must not be empty");
	}

	// ── 1. Resolve content type ───────────────────────────────────────────────
	// Prefer the caller-supplied MIME type; fall back to magic-byte detection.
	const finalContentType: string =
		mimeType ??
		(await fileTypeFromBuffer(buffer))?.mime ??
		"application/octet-stream";

	// Validate early so we don't pay for storage + DB work on unsupported types.
	const dataType = resolveDataType(finalContentType, filename);

	// ── 2. Fetch node (fail fast if missing) ─────────────────────────────────
	const node = await prisma.node.findUniqueOrThrow({
		where: { id: nodeId },
		include: {
			canvas: { select: { userId: true } },
			handles: {
				where: { type: "Output" },
				orderBy: { order: "asc" },
				take: 1,
			},
		},
	});

	const outputHandle = node.handles[0];
	if (!outputHandle) {
		throw new Error(`No output handle found for node ${nodeId}`);
	}

	// ── 3. Extract metadata — run concurrently ────────────────────────────────
	let width: number | null = null;
	let height: number | null = null;
	let durationInSec: number | null = null;
	let fps: number | null = null;

	if (finalContentType.startsWith("image/")) {
		const media = container.get<MediaService>(TOKENS.MEDIA);
		const meta = await media.getImageDimensions(buffer);
		width = meta.width || null;
		height = meta.height || null;

		if (width == null || height == null) {
			throw new Error("Failed to extract image dimensions");
		}
	} else if (finalContentType.startsWith("video/")) {
		const meta = await getVideoMetadata(buffer);
		if (!meta) {
			throw new Error("Failed to extract video metadata");
		}
		width = meta.width;
		height = meta.height;
		durationInSec = meta.duration;
		fps = meta.fps;

		if (width === 0 || height === 0 || durationInSec === 0 || fps === 0) {
			throw new Error(
				`Incomplete video metadata: width=${width}, height=${height}, duration=${durationInSec}, fps=${fps}`,
			);
		}
	} else if (finalContentType.startsWith("audio/")) {
		durationInSec = await getMediaDuration(buffer, finalContentType);
		if (durationInSec == null || durationInSec === 0) {
			throw new Error("Failed to extract audio duration");
		}
	} else if (dataType === "Caption") {
		const captionDuration = extractCaptionDuration(buffer);
		if (captionDuration) {
			durationInSec = captionDuration;
		}
	} else if (dataType === "SVG") {
		try {
			const dim = extractSvgDimensions(buffer);
			const w = dim?.w || 0;
			const h = dim?.h || 0;

			if (w === 0 || h === 0) {
				width = 1080;
				height = 1080;
			} else {
				const aspectRatio = w / h;
				if (w < h) {
					width = 1080;
					height = Math.round(1080 / aspectRatio);
				} else {
					height = 1080;
					width = Math.round(1080 * aspectRatio);
				}
			}
		} catch (error) {
			console.error("Failed to extract SVG dimensions:", error);
			// Default fallback if parsing fails completely
			width = 1080;
			height = 1080;
		}
	}

	// ── 4. Upload to Storage ──────────────────────────────────────────────────
	const key = `assets/${generateId()}-${filename}`;
	const storage = container.get<StorageService>(TOKENS.STORAGE);

	await storage.uploadToStorage(
		buffer,
		key,
		finalContentType,
		ENV_CONFIG.GCS_ASSETS_BUCKET,
	);

	// ── 5. Create asset + update node atomically ──────────────────────────────
	try {
		const updatedNode = await prisma.$transaction(async (tx) => {
			const asset = await tx.fileAsset.create({
				data: {
					name: filename,
					userId: node.canvas.userId,
					bucket: ENV_CONFIG.GCS_ASSETS_BUCKET,
					key,
					isUploaded: true,
					// `!= null` guard: durationInSec could legitimately be 0.
					duration:
						durationInSec != null
							? Math.round(durationInSec * 1000)
							: undefined,
					size: buffer.length,
					width,
					height,
					fps: fps != null ? Math.round(fps) : undefined,
					mimeType: finalContentType,
				},
			});

			const current = await tx.node.findUniqueOrThrow({
				where: { id: nodeId },
				select: { result: true },
			});

			const currentResult = (current.result as any) ?? {
				outputs: [],
			};
			const outputs = currentResult.outputs ?? [];

			const newOutput = {
				items: [
					{
						outputHandleId: outputHandle.id,
						data:
							dataType === "Video" || dataType === "Audio"
								? createVirtualMedia({ entity: asset }, dataType)
								: { entity: asset },
						type: dataType,
					},
				],
			};

			return tx.node.update({
				where: { id: nodeId },
				data: {
					result: {
						...currentResult,
						selectedOutputIndex: outputs.length,
						outputs: [...outputs, newOutput],
					},
				},
				include: { handles: true },
			});
		});

		return updatedNode;
	} catch (err) {
		// Best-effort storage cleanup to avoid orphaned blobs accumulating.
		// Log but don't re-throw the cleanup error — the original error is more useful.
		storage
			.deleteFromStorage?.(key, ENV_CONFIG.GCS_ASSETS_BUCKET)
			.catch((cleanupErr) => {
				console.error(
					`Failed to clean up orphaned storage object gs://${ENV_CONFIG.GCS_ASSETS_BUCKET}/${key}:`,
					cleanupErr,
				);
			});
		throw err;
	}
}
