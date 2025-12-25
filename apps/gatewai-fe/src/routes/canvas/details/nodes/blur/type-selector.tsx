import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type NodeEntityType } from "@/store/nodes";
import { type BlurNodeConfig, BLUR_TYPES } from "@gatewai/types";
import { memo, useCallback } from "react";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

const BlurTypeSelector = memo(({node}: {node: NodeEntityType}) => {
  const config = node?.config as BlurNodeConfig;
  const { onNodeConfigUpdate } = useCanvasCtx();
  
  const handleChange = useCallback((blurType: string) => {
    onNodeConfigUpdate({
      id: node.id,
      newConfig: { blurType }
    });
  }, [node.id, onNodeConfigUpdate]);
  
  return (
    <Select 
      value={config?.blurType ?? 'Box'}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        {BLUR_TYPES.map((bt) => (
          <SelectItem key={bt} value={bt}>
            {bt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

export { BlurTypeSelector }
