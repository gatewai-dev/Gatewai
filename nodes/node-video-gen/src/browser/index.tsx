import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { VideoGenNodeComponent } from "./video-gen-node-component.js";

export default defineClient(metadata, {
	Component: VideoGenNodeComponent,
});
