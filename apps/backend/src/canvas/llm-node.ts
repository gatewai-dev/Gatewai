import type { Node } from "@gatewai/db";
import { NodeProcessor, type NodeProcessResult } from "./node-processor.js";
import { InvalidNodeError } from "../errors/index.js";
import { openai } from "../ai/openai.js";
import type { TextNodeData } from "@gatewai/types";

export class LLMNodeProcessor extends NodeProcessor<string> {
    promptNode: Node;
    constructor(node: Node, promptNode: Node) {
        super(node);
        this.promptNode = promptNode;
    }
    async process(): Promise<NodeProcessResult<string>> {
        if (this.promptNode.type !== 'Text') {
            throw new InvalidNodeError("Invalid Node provided for prompt node", this.node, this.promptNode);
        }
        const promptNodeData = this.promptNode.data as TextNodeData;
        if (promptNodeData.content == null || promptNodeData.content.trim().length === 0) {
            throw new InvalidNodeError("Empty prompt provided.", this.node, this.promptNode);
        }
        const completion = await openai.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: promptNodeData.content,
                },
            ],
        });
        if (!completion.choices[0].message.content) {
            throw new Error("Generated LLM response is empty");
        }
        return {
            result: completion.choices[0].message.content,
            success: true
        };
    }
}
