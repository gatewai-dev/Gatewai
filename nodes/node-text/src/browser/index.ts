import { defineClient } from "@gatewai/node-sdk/browser";
import { PiTextT } from "react-icons/pi";
import { metadata } from "@/metadata.js";
import { TextBrowserProcessor } from "./processor.js";
import { TextNodeComponent } from "./text-node-component.js";

export default defineClient(metadata, {
	Component: TextNodeComponent,
	mainIconComponent: PiTextT,
	processor: TextBrowserProcessor,
});
