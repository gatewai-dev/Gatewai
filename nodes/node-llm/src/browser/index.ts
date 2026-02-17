import { defineClient } from "@gatewai/node-sdk/browser";
import { PiBrain } from "react-icons/pi";
import metadata from "../metadata.js";
import { LlmNodeComponent } from "./llm-node-component.js";
import { LLMNodeConfigComponent } from "./llm-node-config-component.js";

export default defineClient(metadata, {
	Component: LlmNodeComponent,
	ConfigComponent: LLMNodeConfigComponent,
	mainIconComponent: PiBrain,
});
