import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { LlmNodeComponent } from "./llm-node-component.js";

export default defineClient(metadata, {
	Component: LlmNodeComponent,
});
