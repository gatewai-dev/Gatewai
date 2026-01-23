import type { Canvas } from "@gatewai/db";
import { InMemoryRunner } from "@google/adk";
import { CreateOrchestratorAgentForCanvas } from "../agents/orchestrator/index.js";

async function GetCanvasAgentRunner({ canvasId }: { canvasId: Canvas["id"] }) {
	const agent = await CreateOrchestratorAgentForCanvas({ canvasId });

	const runner = new InMemoryRunner({
		appName: "Gatewai",
		agent: agent,
	});

	return runner;
}

export { GetCanvasAgentRunner };
