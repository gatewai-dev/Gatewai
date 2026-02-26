import { ENV_CONFIG, generateId } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { StorageService } from "@gatewai/core/storage";
import type { MediaService, NodeResult } from "@gatewai/core/types";
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
	"Image" | "Video" | "Audio" | "Lottie" | "Json" | "SVG" | "ThreeD" | "Caption"
>;

function isValidLottieJson(json: unknown): json is {
	w: number;
	h: number;
	fr?: number;
	ip?: number;
	op?: number;
	layers?: unknown[];
	assets?: unknown[];
} {
	if (!json || typeof json !== "object") return false;
	const obj = json as Record<string, unknown>;
	return (
		typeof obj.w === "number" &&
		typeof obj.h === "number" &&
		obj.w > 0 &&
		obj.h > 0 &&
		(Array.isArray(obj.layers) || Array.isArray(obj.assets))
	);
}

function extractLottieMetadata(buffer: Buffer): {
	width: number;
	height: number;
	durationInSec: number | null;
	fps: number | null;
} | null {
	try {
		const str = buffer.toString("utf-8");
		const json = JSON.parse(str);
		if (!isValidLottieJson(json)) return null;

		const width = json.w;
		const height = json.h;
		const fps = json.fr ?? 30;
		const ip = json.ip ?? 0;
		const op = json.op ?? 0;

		const durationInSec = op > ip ? (op - ip) / fps : null;

		return { width, height, durationInSec, fps };
	} catch {
		return null;
	}
}

const dropzoneLabel =
	"Click or drag & drop an image, SVG, video, audio, Lottie, 3D, or SRT file here";

const accept = {
	"image/*": [".png", ".gif", ".jpeg", ".jpg", ".webp"],
	"image/svg+xml": [".svg"],
	"video/*": [".mp4", ".mov", ".webm"],
	"audio/*": [".mp3", ".wav", ".ogg"],
	"application/json": [".json", ".lottie"],
	"model/gltf+json": [".gltf"],
	"model/gltf-binary": [".glb"],
	"model/obj": [".obj"],
	"model/stl": [".stl"],
	"text/srt": [".srt"],
};

const getFilteredAccept = (
	type:
		| "image"
		| "video"
		| "audio"
		| "lottie"
		| "svg"
		| "threed"
		| "caption"
		| null,
) => {
	const keys = Object.keys(accept);
	if (!type) return keys;
	if (type === "lottie") return ["application/json"];
	if (type === "svg") return ["image/svg+xml"];
	if (type === "caption") return ["text/srt"];
	if (type === "threed")
		return keys.filter((mime) => mime.startsWith("model/"));
	return keys.filter((mime) => mime.startsWith(`${type}/`));
};

function resolveDataType(
	contentType: string,
	filename: string,
	buffer?: Buffer,
): SupportedDataType {
	if (contentType === "image/svg+xml") return "SVG";
	if (contentType.startsWith("image/")) return "Image";
	if (contentType.startsWith("video/")) return "Video";
	if (contentType.startsWith("audio/")) return "Audio";
	if (contentType.startsWith("model/")) return "ThreeD";

	const isJsonContent =
		contentType === "application/json" || contentType === "text/plain";
	const isLottieExtension = filename.toLowerCase().endsWith(".lottie");

	if (isLottieExtension) {
		return "Lottie";
	}

	if (isJsonContent && buffer) {
		const lottieMeta = extractLottieMetadata(buffer);
		if (lottieMeta) {
			return "Lottie";
		}
		return "Json";
	}

	if (isJsonContent) {
		return "Json";
	}

	// Fallback for some common 3D formats if mime-type detection failed or is generic
	const ext = filename.toLowerCase().split(".").pop();
	if (ext && ["glb", "gltf", "obj", "stl"].includes(ext)) {
		return "ThreeD";
	}
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
	const dataType = resolveDataType(finalContentType, filename, buffer);

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
	} else if (dataType === "Lottie") {
		const lottieMeta = extractLottieMetadata(buffer);
		if (lottieMeta) {
			width = lottieMeta.width;
			height = lottieMeta.height;
			durationInSec = lottieMeta.durationInSec;
			fps = lottieMeta.fps;
		}
	} else if (dataType === "SVG") {
		try {
			const media = container.get<MediaService>(TOKENS.MEDIA);
			const meta = await media.getImageDimensions(buffer);
			width = meta.width || null;
			height = meta.height || null;
		} catch (error) {
			console.error("Failed to extract SVG dimensions:", error);
		}
	}
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

			// Re-fetch result inside the transaction to avoid a lost-update race
			// if another request appended an output between our initial read and now.
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
							dataType === "Video" ||
							dataType === "Audio" ||
							dataType === "Lottie"
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
