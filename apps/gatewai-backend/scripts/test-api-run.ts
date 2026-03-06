/**
 * Test script for API Run with various file input types
 *
 * Usage:
 *   pnpm tsx apps/gatewai-fe/backend/scripts/test-api-run.ts
 *
 * Prerequisites:
 *   - Backend running at http://localhost:8081
 *   - Valid API key
 *   - Canvas with File and/or Text nodes
 */

import { GatewaiApiClient } from "@gatewai/api-client";

const API_KEY = "gte_e69d7b15121848268cb70e135deed6e9";
const BASE_URL = "http://localhost:8081";

// Replace with your actual canvas and node IDs
const CANVAS_ID = "cmlazybli00010r3ktk59x88k";
const TEXT_NODE_ID = "z1JVTGrmfFL1KPPoW3DWms";
const FILE_NODE_ID = "ClFAWkdy0XJH3JD1l0ZBqs";

const client = new GatewaiApiClient({
	baseUrl: BASE_URL,
	apiKey: API_KEY,
});

async function testBasicRun() {
	console.log("\n=== Test 1: Basic Run (with duplication) ===");
	try {
		const result = await client.run({
			canvasId: CANVAS_ID,
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function testRunWithoutDuplication() {
	console.log("\n=== Test 2: Run Without Duplication ===");
	try {
		const result = await client.run({
			canvasId: CANVAS_ID,
			duplicate: false,
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function testTextInput() {
	console.log("\n=== Test 3: Text Node Input ===");
	try {
		const result = await client.run({
			canvasId: CANVAS_ID,
			payload: {
				[TEXT_NODE_ID]: "Hello from test script!",
			},
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function testFileFromUrl() {
	console.log("\n=== Test 4: File Input from URL ===");
	try {
		const result = await client.run({
			canvasId: CANVAS_ID,
			payload: {
				[FILE_NODE_ID]: GatewaiApiClient.fromUrl(
					"https://picsum.photos/200/300",
				),
			},
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function testFileFromBase64() {
	console.log("\n=== Test 5: File Input from Base64 ===");
	try {
		// 1x1 red PNG pixel
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

		const result = await client.run({
			canvasId: CANVAS_ID,
			payload: {
				[FILE_NODE_ID]: GatewaiApiClient.fromBase64(base64Data, "image/png"),
			},
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function testFileFromAssetId() {
	console.log("\n=== Test 6: File Input from Asset ID ===");
	try {
		// First, list assets to get a valid ID
		const assets = await client.listAssets({ limit: 1 });
		if (!assets || !Array.isArray(assets) || assets.length === 0) {
			console.log("⚠️ Skipped: No existing assets found");
			return;
		}

		const assetId = assets[0].id;
		console.log("Using asset:", assetId);

		const result = await client.run({
			canvasId: CANVAS_ID,
			payload: {
				[FILE_NODE_ID]: GatewaiApiClient.fromAssetId(assetId),
			},
		});
		console.log("✅ Success:", result);
		console.log("Batch ID:", result.batchHandleId);
	} catch (error) {
		console.error("❌ Failed:", error);
	}
}

async function runAllTests() {
	console.log("🧪 API Run Test Suite");
	console.log("=====================");
	console.log(`Base URL: ${BASE_URL}`);
	console.log(`Canvas ID: ${CANVAS_ID}`);

	await testBasicRun();
	await testRunWithoutDuplication();
	await testTextInput();
	await testFileFromUrl();
	await testFileFromBase64();
	await testFileFromAssetId();

	console.log("\n✨ All tests completed!");
}

runAllTests().catch(console.error);
