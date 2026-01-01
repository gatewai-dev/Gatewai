import { existsSync, mkdirSync } from "node:fs";
import type { Node } from "@gatewai/db";
import sharp from "sharp";
import { logger } from "./logger.js";

async function logMedia(
	buffer: Buffer,
	extension: string = ".png",
	nodeId?: Node["id"],
) {
	try {
		const debug_path = `${process.cwd()}/debug_media/`;
		const exists = existsSync(debug_path);
		if (!exists) {
			mkdirSync(debug_path);
		}
		const filePath = `${process.cwd()}/debug_media/${new Date().toISOString()}_${nodeId ?? ""}${extension}`;
		await sharp(buffer).toFile(filePath);
	} catch (error) {
		console.log(error);
		logger.warn("Unable to save media");
		logger.error(error);
	}
}

export { logMedia };
