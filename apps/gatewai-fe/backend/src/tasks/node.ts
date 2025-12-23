import type { Edge, Node } from "@gatewai/db";
import { UniqueIdQueue } from "./queue.js";

export class NodeProcessor {
    queue: UniqueIdQueue<Node["id"]>;
    constructor() {
        this.queue = new UniqueIdQueue<Node["id"]>;
    }

    enqueueNodes(nodes: Node[], edges: Edge[]) {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            this.enqueue(node);
        }
    }

    enqueue(node: Node) {
        this.queue.enqueue(node.id);
    }

    loop() {
        
    }
}