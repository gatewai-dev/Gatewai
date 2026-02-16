import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { TbAdjustments } from "react-icons/tb";
import metadata from "../metadata.js";
import { ModulateNodeComponent } from "./modulate-node-component.js";
import { ModulateBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: ModulateNodeComponent,
	processor: ModulateBrowserProcessor,
	mainIconComponent: memo(TbAdjustments),
});
