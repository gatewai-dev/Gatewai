import { DataType } from "@gatewai/db";
import type {
    BlurNodeConfig,
    FileData,
    HSLNodeConfig,
    NodeResult,
    Output,
} from "@gatewai/types";
import {
    applyBlur,
    applyHSL,
    bufferToDataUrl,
    getImageBuffer,
    getMimeType,
} from "../../utils/image.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const hslProcessor: NodeProcessor = async ({ node, data }) => {
    try {
        const imageInput = getInputValue(data, node.id, true, {
            dataType: DataType.Image,
            label: "Image",
        }) as FileData | null;
        const hslConfig = node.config as HSLNodeConfig;

        if (!imageInput) {
            return { success: false, error: "No image input provided" };
        }

        const buffer = await getImageBuffer(imageInput);
        const processedBuffer = await applyHSL(buffer, hslConfig);
        const mimeType = getMimeType(imageInput);
        const dataUrl = bufferToDataUrl(processedBuffer, mimeType);

        // Build new result (similar to LLM)
        const outputHandle = data.handles.find(
            (h) => h.nodeId === node.id && h.type === "Output",
        );
        if (!outputHandle) throw new Error("Output handle is missing");

        const newResult: NodeResult = structuredClone(
            node.result as NodeResult,
        ) ?? {
            outputs: [],
            selectedOutputIndex: 0,
        };

        const newGeneration: Output = {
            items: [
                {
                    type: DataType.Image,
                    data: { dataUrl }, // Transient data URL
                    outputHandleId: outputHandle.id,
                },
            ],
        };

        newResult.outputs.push(newGeneration);

        return { success: true, newResult };
    } catch (err: unknown) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Blur processing failed",
        };
    }
};

export default hslProcessor;
