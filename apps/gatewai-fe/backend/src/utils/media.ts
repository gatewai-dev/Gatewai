import { spawn } from "node:child_process";
import fs from "node:fs/promises"; // Use the promises API
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { generateId } from "./misc.js";

/**
 * Gets the duration of media (video/audio) using ffprobe.
 */
export async function getMediaDuration(buffer: Buffer): Promise<number | null> {
	const tempDir = os.tmpdir();
	const tempFile = path.join(tempDir, `temp_media_${generateId()}`);

	try {
		await fs.writeFile(tempFile, buffer);

		return await new Promise((resolve, reject) => {
			const ffprobe = spawn("ffprobe", [
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"default=noprint_wrappers=1:nokey=1",
				tempFile,
			]);

			let output = "";

			ffprobe.stdout.on("data", (data) => {
				output += data.toString();
			});

			ffprobe.on("error", (err) => {
				reject(new Error(`Failed to start ffprobe: ${err.message}`));
			});

			ffprobe.on("close", (code) => {
				if (code === 0) {
					const duration = parseFloat(output.trim());
					resolve(Number.isNaN(duration) ? null : duration);
				} else {
					reject(new Error(`ffprobe exited with code ${code}`));
				}
			});
		});
	} finally {
		// Cleanup: Use the promise-based unlink
		try {
			await fs.unlink(tempFile);
		} catch (err) {
			console.error("Failed to delete temp file:", err);
		}
	}
}

/**
 * Generates a thumbnail buffer from a video URL using FFmpeg and Sharp.
 * * Strategy:
 * 1. Spawn FFmpeg to seek to 00:00:01.
 * 2. Output a single frame as PNG to stdout.
 * 3. Pipe stdout into Sharp for resizing and WebP conversion.
 */
export async function generateVideoThumbnail(
	videoUrl: string,
	width: number,
	height: number,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn("ffmpeg", [
			"-i",
			videoUrl,
			"-ss",
			"00:00:00.500",
			"-vframes",
			"1",
			"-f",
			"image2pipe",
			"-vcodec",
			"png",
			"-", // Output to stdout
		]);

		const chunks: Buffer[] = [];
		const errChunks: Buffer[] = [];

		ffmpeg.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});

		ffmpeg.stderr.on("data", (chunk) => {
			errChunks.push(chunk);
		});

		ffmpeg.on("close", async (code) => {
			if (code !== 0) {
				const errorMessage = Buffer.concat(errChunks).toString();
				console.error("FFmpeg error:", errorMessage);
				return reject(new Error(`FFmpeg process exited with code ${code}`));
			}

			const rawFrame = Buffer.concat(chunks);
			if (rawFrame.length === 0) {
				return reject(new Error("FFmpeg produced no output"));
			}

			try {
				const webpBuffer = await sharp(rawFrame)
					.resize({
						width,
						height,
						fit: "cover",
						position: "center",
					})
					.toFormat("webp", { quality: 80 })
					.toBuffer();
				resolve(webpBuffer);
			} catch (error) {
				reject(error);
			}
		});

		ffmpeg.on("error", (err) => {
			reject(err);
		});
	});
}

/**
 * Generates a thumbnail from an image buffer using Sharp.
 */
export async function generateImageThumbnail(
	imageBuffer: Buffer,
	width: number,
	height: number,
): Promise<Buffer> {
	return sharp(imageBuffer)
		.rotate() // Auto-rotate based on EXIF
		.resize({
			width,
			height,
			fit: "cover",
			position: "center",
		})
		.toFormat("webp", { quality: 80 })
		.toBuffer();
}
