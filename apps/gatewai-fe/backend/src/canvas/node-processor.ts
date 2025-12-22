import type { Node } from "@gatewai/db";

export type NodeProcessResult<T> = {
    result: T;
    success: boolean;
    error?: string;
}

export abstract class NodeProcessor<T> {
    node: Node;
    constructor(node: Node) {
        this.node = node;
    }

    abstract process(): Promise<NodeProcessResult<T>>;

}