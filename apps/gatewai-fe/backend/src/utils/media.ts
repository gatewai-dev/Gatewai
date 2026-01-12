import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto"; // Missing import
import fs from "node:fs/promises"; // Use the promises API
import os from "node:os";
import path from "node:path";

/**
 * Gets the duration of media (video/audio) using ffprobe.
 */
export async function getMediaDuration(buffer: Buffer): Promise<number | null> {
	const tempDir = os.tmpdir();
	const tempFile = path.join(tempDir, `temp_media_${randomUUID()}`);

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
				tempFile, // Removed '-i' (optional, but cleaner)
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
					resolve(isNaN(duration) ? null : duration);
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
