import { defineClient } from "@gatewai/node-sdk/browser";
import { TbAdjustments } from "react-icons/tb";
import { metadata } from "../metadata.js";
import { ModulateNodeComponent } from "./modulate-node-component.js";
import { ModulateBrowserProcessor } from "./processor.js";

// Config is rendered under node component - no need to apply
export default defineClient(metadata, {
	Component: ModulateNodeComponent,
	processor: ModulateBrowserProcessor,
	mainIconComponent: TbAdjustments,
});
