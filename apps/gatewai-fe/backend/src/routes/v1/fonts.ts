import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { zValidator } from "@hono/zod-validator";
import { fileTypeFromBuffer } from "file-type";
import { Hono } from "hono";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsRouter = new Hono({
	strict: false,
})
	.get("/", async (c) => {
		try {
			const assetsDir = path.join(__dirname, "../../assets/fonts");
			const dirents = await fs.readdir(assetsDir, { withFileTypes: true });
			const fontNames = dirents
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);
			return c.json(fontNames);
		} catch (error) {
			console.error("Failed to list fonts:", error);
			return c.json({ error: "Failed to list fonts" }, 500);
		}
	})
	.get(
		"/load/:fontName",
		zValidator("param", z.object({ fontName: z.string() })),
		async (c) => {
			const fontName = c.req.param("fontName");
			const fontDir = path.join(__dirname, "../../assets/fonts", fontName);
			try {
				const files = await fs.readdir(fontDir);
				const fontFile = files.find(
					(f) =>
						f.endsWith(".woff") ||
						f.endsWith(".woff2") ||
						f.endsWith(".ttf") ||
						f.endsWith(".otf"),
				);
				if (!fontFile) {
					return c.json({ error: "Font file not found" }, 404);
				}
				const filePath = path.join(fontDir, fontFile);
				const buffer = await fs.readFile(filePath);
				const fileTypeResult = await fileTypeFromBuffer(buffer);
				const contentType = fileTypeResult?.mime ?? "application/octet-stream";
				const headers = {
					"Content-Type": contentType,
					"Content-Disposition": `inline; filename="${fontFile}"`,
					"Cache-Control": "public, max-age=31536000, immutable",
				};
				return c.body(buffer, { headers });
			} catch (error) {
				console.error("Failed to fetch font:", error);
				return c.json({ error: "Failed to fetch font" }, 500);
			}
		},
	);

export { fontsRouter };
