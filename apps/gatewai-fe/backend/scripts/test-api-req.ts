import { type APIResponse, GatewaiApiClient } from "@gatewai/api-client";

const CANVAS_ID_TO_RUN = "cmk384pl0000w0rsnbeig7xpz";

const client = new GatewaiApiClient({
	GATEWAI_URL: "http://localhost:8081",
});

async function MakeRequest() {
	let resp: APIResponse;
	resp = await client.makeRequest({
		canvasId: CANVAS_ID_TO_RUN,
		payload: {
			"4tu9jIt4nLz705yRE62c9w": "Tell me a JOKE - DARK ONE.",
		},
	});

	if (resp.batchHandleId) {
		while (resp.result == null) {
			resp = await client.checkStatus(resp.batchHandleId as string);
			console.log(JSON.stringify(resp));
			if (typeof resp.success === "boolean" && resp.success === false) break;
			if (resp.success) {
				break;
			}
			await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
		}
	}
}

MakeRequest()
	.then(() => {
		process.exit(0);
	})
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
