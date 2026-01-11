import assert from "node:assert";
import { GatewaiApiClient } from "@gatewai/api-client";

const client = new GatewaiApiClient({
	baseUrl: "http://localhost:8081",
});

async function runExample() {
	try {
		console.log("Starting run...");

		const response = await client.run({
			canvasId: "cmk384pl0000w0rsnbeig7xpz",
			payload: {
				"4tu9jIt4nLz705yRE62c9w": "Tell me a dark joke about coding.",
			},
		});

		if (response.success) {
			console.log("✅ Workflow Complete!");
			const exportNodeId = "QtOTDB2wrADTKBF5enhJ2D";
			assert(response.result);
			const exportResult = response.result[exportNodeId];
			console.table(exportResult);
		} else {
			console.error("❌ Workflow Failed:", response.error);
		}
	} catch (err) {
		console.error("💀 Fatal Client Error:", err);
	}
}

runExample();
