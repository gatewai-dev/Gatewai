import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateId } from "@gatewai/core";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

/**
 * Gets the duration of media (video/audio) using ffprobe.
 */
export async function getMediaDuration(
	buffer: Buffer,
	mimeType?: string,
): Promise<number | null> {
	const tempDir = os.tmpdir();
	const type = await fileTypeFromBuffer(buffer);

	// Try to get extension from detected type, otherwise fallback to mimeType hint
	let ext = type ? `.${type.ext}` : "";
	if (!ext && mimeType) {
		const mimeMap: Record<string, string> = {
			"audio/mpeg": ".mp3",
			"audio/mp3": ".mp3",
			"audio/wav": ".wav",
			"audio/x-wav": ".wav",
			"audio/ogg": ".ogg",
			"audio/aac": ".aac",
			"audio/m4a": ".m4a",
			"video/mp4": ".mp4",
			"video/quicktime": ".mov",
			"video/x-matroska": ".mkv",
		};
		ext = mimeMap[mimeType] || "";
	}

	const tempFile = path.join(tempDir, `temp_media_${generateId()}${ext}`);
	console.log({ tempFile });
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
			let errorOutput = "";

			ffprobe.stdout.on("data", (data) => {
				output += data.toString();
			});

			ffprobe.stderr.on("data", (data) => {
				errorOutput += data.toString();
			});

			ffprobe.on("error", (err) => {
				reject(new Error(`Failed to start ffprobe: ${err.message}`));
			});

			ffprobe.on("close", (code) => {
				if (code === 0) {
					const duration = parseFloat(output.trim());
					resolve(Number.isNaN(duration) ? null : duration);
				} else {
					const header = buffer.subarray(0, 16).toString("hex");
					reject(
						new Error(
							`ffprobe exited with code ${code}. stderr: ${errorOutput.trim()}. buffer(hex): ${header}, size: ${buffer.length}, hint: ${mimeType}, detected: ${type?.mime}`,
						),
					);
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
 * Gets video metadata (width, height, fps, duration) using ffprobe.
 */
export async function getVideoMetadata(buffer: Buffer): Promise<{
	width: number;
	height: number;
	fps: number;
	duration: number;
} | null> {
	const tempDir = os.tmpdir();
	const type = await fileTypeFromBuffer(buffer);
	const ext = type ? `.${type.ext}` : "";
	const tempFile = path.join(tempDir, `temp_video_meta_${generateId()}${ext}`);

	try {
		await fs.writeFile(tempFile, buffer);

		return await new Promise((resolve, reject) => {
			const ffprobe = spawn("ffprobe", [
				"-v",
				"error",
				"-select_streams",
				"v:0",
				"-show_entries",
				"stream=width,height,avg_frame_rate,duration",
				"-of",
				"json",
				tempFile,
			]);

			let output = "";
			let errorOutput = "";

			ffprobe.stdout.on("data", (data) => {
				output += data.toString();
			});

			ffprobe.stderr.on("data", (data) => {
				errorOutput += data.toString();
			});

			ffprobe.on("error", (err) => {
				reject(new Error(`Failed to start ffprobe: ${err.message}`));
			});

			ffprobe.on("close", (code) => {
				if (code === 0) {
					try {
						const data = JSON.parse(output);
						const stream = data.streams?.[0];

						if (!stream) {
							return resolve(null);
						}

						const width = Number(stream.width);
						const height = Number(stream.height);
						const duration = parseFloat(stream.duration);

						// Parse avg_frame_rate (e.g., "30/1" or "24000/1001")
						let fps = 0;
						if (stream.avg_frame_rate) {
							const [num, den] = stream.avg_frame_rate.split("/");
							if (num && den) {
								fps = Number(num) / Number(den);
							}
						}

						resolve({
							width: Number.isNaN(width) ? 0 : width,
							height: Number.isNaN(height) ? 0 : height,
							fps: Number.isNaN(fps) ? 0 : fps,
							duration: Number.isNaN(duration) ? 0 : duration,
						});
					} catch (err) {
						reject(new Error(`Failed to parse ffprobe output: ${err}`));
					}
				} else {
					reject(
						new Error(
							`ffprobe exited with code ${code}. stderr: ${errorOutput.trim()}`,
						),
					);
				}
			});
		});
	} finally {
		try {
			await fs.unlink(tempFile);
		} catch (err) {
			console.error("Failed to delete temp file:", err);
		}
	}
}

/**
 * Generates a thumbnail buffer from a video URL using FFmpeg and Sharp.
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
				return reject(
					new Error(
						`FFmpeg process exited with code ${code}. stderr: ${errorMessage.trim()}`,
					),
				);
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

/**
 * Fetches a file from a URL and converts it to a base64 string
 */
export async function urlToBase64(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer).toString("base64");
}
