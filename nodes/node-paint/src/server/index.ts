import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { PaintProcessor } from "./processor.js";

export const paintNode = defineNode(metadata, { backendProcessor: PaintProcessor });

export default paintNode;
