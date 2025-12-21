import type { AllNodeData, NodeTemplate, NodeTemplateInput, NodeTemplateOutput } from "@gatewai/types";
import type { Node } from "@xyflow/react";

export type NodeTemplateWithIO = NodeTemplate & {
    inputTypes: NodeTemplateInput[];
    outputTypes: NodeTemplateOutput[];
}

export type ClientNodeData = Node & {
    data: AllNodeData & {
        template: NodeTemplateWithIO;
    };
}