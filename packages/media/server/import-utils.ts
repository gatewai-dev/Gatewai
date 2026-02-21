import { ENV_CONFIG, generateId } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { StorageService } from "@gatewai/core/storage";
import type { MediaService, NodeResult } from "@gatewai/core/types";
import { type DataType, prisma } from "@gatewai/db";
import { fileTypeFromBuffer } from "file-type";
import { getMediaDuration } from "./utils/index.js";

interface UploadOptions {
	nodeId: string;
	buffer: Buffer;
	filename: string;
	mimeType?: string;
}

type SupportedDataType = Extract<DataType, "Image" | "Video" | "Audio">;

function resolveDataType(contentType: string): SupportedDataType {
	if (contentType.startsWith("image/")) return "Image";
	if (contentType.startsWith("video/")) return "Video";
	if (contentType.startsWith("audio/")) return "Audio";
	throw new Error(`Unsupported content type for Import Node: ${contentType}`);
}

/**
 * Uploads a buffer to GCS, creates a FileAsset record, and appends an output
 * entry to the node's result.
 *
 * Ordering guarantees:
 *  1. Storage upload happens first — no DB rows are written if this fails.
 *  2. FileAsset creation and node update are wrapped in a transaction —
 *     failure leaves no orphaned asset records.
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
	const dataType = resolveDataType(finalContentType);

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

	await Promise.allSettled([
		(async () => {
			if (finalContentType.startsWith("image/")) {
				try {
					const media = container.get<MediaService>(TOKENS.MEDIA);
					const meta = await media.getImageDimensions(buffer);
					width = meta.width || null;
					height = meta.height || null;
				} catch (err) {
					console.error("Failed to extract image dimensions:", err);
				}
			}
		})(),
		(async () => {
			if (
				finalContentType.startsWith("video/") ||
				finalContentType.startsWith("audio/")
			) {
				try {
					durationInSec = await getMediaDuration(buffer);
				} catch (err) {
					console.error("Failed to extract media duration:", err);
				}
			}
		})(),
	]);
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
					mimeType: finalContentType,
				},
			});

			// Re-fetch result inside the transaction to avoid a lost-update race
			// if another request appended an output between our initial read and now.
			const current = await tx.node.findUniqueOrThrow({
				where: { id: nodeId },
				select: { result: true },
			});

			const currentResult = (current.result as unknown as ImportResult) ?? {
				outputs: [],
			};
			const outputs = currentResult.outputs ?? [];

			const newOutput = {
				items: [
					{
						outputHandleId: outputHandle.id,
						data: { entity: asset },
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
