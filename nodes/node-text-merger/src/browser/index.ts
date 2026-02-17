import { defineClient } from "@gatewai/node-sdk/browser";
import { PiArrowsMerge } from "react-icons/pi";
import metadata from "../metadata.js";
import { TextMergerBrowserProcessor } from "./processor.js";
import { TextMergerNodeComponent } from "./text-merger-node-component.js";

export default defineClient(metadata, {
	Component: TextMergerNodeComponent,
	mainIconComponent: PiArrowsMerge,
	processor: TextMergerBrowserProcessor,
});
