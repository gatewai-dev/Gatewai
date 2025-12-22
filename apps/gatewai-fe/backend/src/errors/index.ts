import type { Node } from "@gatewai/db";

export class InvalidNodeError extends Error {
    constructor(message: string, mainNode: Node, relatedNode?: Node) {
        const errorMessage = `Error when processing node with ID: ${mainNode.id}\n Related Node: ${relatedNode?.id ?? "NA"}\n Original Message: ${message}`
        super(errorMessage);
        this.cause = relatedNode;
    }
}