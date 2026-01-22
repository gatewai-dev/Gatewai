import { InMemorySessionService, Runner } from "@google/adk";

import { OrchestratorAgent } from "../agents/orchestrator/index.js";

const runner = new Runner({
	appName: "Gatewai",
	sessionService: new InMemorySessionService(),
	agent: OrchestratorAgent,
});

export { runner };
