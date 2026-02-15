import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { VideoGenFirstLastFrameNodeComponent } from "./video-gen-first-last-frame-node-component.js";

export default defineClient(metadata, {
	Component: VideoGenFirstLastFrameNodeComponent,
});
