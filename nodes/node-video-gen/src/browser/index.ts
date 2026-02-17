import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiVideoCamera } from "react-icons/pi";
import metadata from "../metadata.js";
import { VideoGenNodeComponent } from "./video-gen-node-component.js";

export default defineClient(metadata, {
	Component: VideoGenNodeComponent,
	mainIconComponent: PiVideoCamera,
	processor: BrowserPassthroughProcessor,
});
