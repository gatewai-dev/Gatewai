import { defineClient } from "@gatewai/node-sdk/browser";
import { ModulateNodeComponent } from "./modulate-node-component.js";
import { ModulateBrowserProcessor } from "./processor.js";
import { ModulateConfigComponent } from "./modulate-config-component.js";
import { memo } from "react";
import { TbAdjustments } from "react-icons/tb";
import { metadata } from "../metadata.js";

export default defineClient(metadata, {
	Component: ModulateNodeComponent,
	ConfigComponent: ModulateConfigComponent,
	processor: ModulateBrowserProcessor,
	mainIconComponent: memo(TbAdjustments),
});
