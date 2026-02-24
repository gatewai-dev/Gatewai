import { defineClient } from "@gatewai/node-sdk/browser";
import { metadata } from "../metadata.js";
import { VideoCutNodeComponent } from "./video-cut-node-component.js";

export default defineClient(metadata, {
	Component: VideoCutNodeComponent,
	processor: 
});
