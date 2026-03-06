import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiMagicWand } from "react-icons/pi";
import metadata from "../metadata.js";
import { ImageGenNodeComponent } from "./image-gen-node-component.js";
import { ImageGenNodeConfigComponent } from "./image-gen-node-config-component.js";

export default defineClient(metadata, {
	Component: ImageGenNodeComponent,
	mainIconComponent: PiMagicWand,
	ConfigComponent: ImageGenNodeConfigComponent,
	processor: BrowserPassthroughProcessor,
});
