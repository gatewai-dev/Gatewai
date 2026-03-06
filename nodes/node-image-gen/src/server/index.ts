import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { ImageGenProcessor } from "./processor.js";

export default defineNode(metadata, { backendProcessor: ImageGenProcessor });
