import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GatewaiApiClient } from "@gatewai/api-client";

// 1. Get the directory name of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new GatewaiApiClient({
	baseUrl: "http://localhost:8081",
});

async function runExample() {
	try {
		console.log("Starting run...");

		// 2. Create absolute paths for input and output
		const inputPath = join(__dirname, "chart.png");
		const outputPath = join(__dirname, "output.png");

		const base64Data = readFileSync(inputPath, {
			encoding: "base64",
		});

		const mimeType = "image/png";
		const fullBase64String = `data:${mimeType};base64,${base64Data}`;

		const response = await client.run({
			canvasId: "cmk384pl0000w0rsnbeig7xpz",
			payload: {
				"4tu9jIt4nLz705yRE62c9w": "Your text here", // Updated for clarity
				SRwEtTlg9ym9FeHTDJvQ6n: fullBase64String,
			},
		});

		if (response.success) {
			console.log("Workflow Complete!");
			const exportNodeId = "QtOTDB2wrADTKBF5enhJ2D";
			assert(response.result);
			const exportResult = response.result[exportNodeId];
			// exportResult.data contains signed url of the generation
			// The url will be removed after 2 days
			assert(exportResult.data);
			const resp = await fetch(exportResult.data as string);
			const blob = await resp.blob();
			const abuffer = await blob.arrayBuffer();
			const buffer = Buffer.from(abuffer);
			// 3. Write to the absolute output path
			writeFileSync(outputPath, buffer);
			console.log(`Image saved to: ${outputPath}`);
		} else {
			console.error("Workflow Failed:", response.error);
		}
	} catch (err) {
		console.error("Fatal Client Error:", err);
	}
}

runExample();
