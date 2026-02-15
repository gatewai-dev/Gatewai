import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { TextMergerNodeComponent } from "./text-merger-node-component.js";

export default defineClient(metadata, {
	Component: TextMergerNodeComponent,
});
