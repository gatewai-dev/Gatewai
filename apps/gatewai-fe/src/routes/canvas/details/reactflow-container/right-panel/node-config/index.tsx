import { useAppSelector } from "@/store";
import { memo, type ReactNode } from "react";
import { selectSelectedNodes, type NodeEntityType } from "@/store/nodes";
import type { NodeType } from "@gatewai/db";
import { LLMNodeConfigComponent } from "./llm/llm-config";

type NodeConfigComponentProps = {
  node: NodeEntityType;
};

const NodeConfigFormMap: Partial<Record<NodeType, (props: NodeConfigComponentProps) => ReactNode>> = {
  'LLM': LLMNodeConfigComponent
};

const NodeConfigPanel = memo(() => {
  const selectedNodes = useAppSelector(selectSelectedNodes);
  if (!selectedNodes || selectedNodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {selectedNodes.map((node) => {
        const ConfigComponent = NodeConfigFormMap[node.type] as ((props: NodeConfigComponentProps) => ReactNode) | undefined;
        if (!ConfigComponent) {
          return null;
        }
        return <ConfigComponent key={node.id} node={node} />;
      })}
    </div>
  );
});

export { NodeConfigPanel };