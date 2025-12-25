import { useAppSelector } from "@/store";
import { memo, type ReactNode } from "react";
import { selectSelectedNodes } from "@/store/nodes";
import type { NodeType } from "@gatewai/db";
import { LLMNodeConfigComponent } from "./llm/llm-config";

const NodeConfigFormMap: Partial<Record<NodeType, ReactNode>> = {
  'LLM': LLMNodeConfigComponent
}

const NodeConfigPanel = memo(() => {
    const selectedNodes = useAppSelector(selectSelectedNodes);
    if (!selectSelectedNodes || selectSelectedNodes.length === 0) {
        return null
    }

    return (
      <></>
    );
});

export { NodeConfigPanel };