import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiMagicWand } from "react-icons/pi";
import metadata from "../metadata.js";
import { ImageGenNodeComponent } from "./image-gen-node-component.js";

export default defineClient(metadata, {
	Component: ImageGenNodeComponent,
	mainIconComponent: memo(PiMagicWand),
});
