import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiFrameCorners } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { VideoGenFirstLastFrameNodeComponent } from "./video-gen-first-last-frame-node-component.js";

export default defineClient(metadata, {
	Component: VideoGenFirstLastFrameNodeComponent,
	mainIconComponent: PiFrameCorners,
	processor: BrowserPassthroughProcessor,
});
