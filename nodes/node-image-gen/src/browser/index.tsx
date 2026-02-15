import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { ImageGenNodeComponent } from "./image-gen-node-component.js";

export default defineClient(metadata, {
	Component: ImageGenNodeComponent,
});
