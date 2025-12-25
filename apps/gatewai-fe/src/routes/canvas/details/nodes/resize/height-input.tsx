import { Input } from "@/components/ui/input";
import { type NodeEntityType } from "@/store/nodes";
import type { ResizeNodeConfig } from "@gatewai/types";
import { memo, useCallback } from "react";
import { useCanvasCtx } from "../../ctx/canvas-ctx";


const ResizeHeightInput = memo(({node, originalWidth, originalHeight, maintainAspect}: {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null, maintainAspect: boolean}) => {
  const config: ResizeNodeConfig = node?.config as ResizeNodeConfig;
    const { onNodeConfigUpdate } = useCanvasCtx();
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valueStr = e.target.value;
    if (valueStr === '') return;
    const value = parseInt(valueStr, 10);
    if (isNaN(value) || value < 1 || value > 2000) return;
    
    let updates: Partial<ResizeNodeConfig> = { height: value };
    if (maintainAspect && originalWidth && originalHeight) {
      const newWidth = Math.round((originalWidth / originalHeight) * value);
      updates = { ...updates, width: newWidth };
    }
    
    onNodeConfigUpdate({
      id: node.id,
      newConfig: updates
    });
  }, [maintainAspect, originalWidth, originalHeight, onNodeConfigUpdate, node.id]);
  
  const displayValue = config.height ?? originalHeight ?? 0;
  
  return (
    <div className="flex items-center gap-1 flex-1">
      <label className="text-xs text-gray-600">Height</label>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayValue}
        onChange={handleChange}
      />
    </div>
  );
});

export { ResizeHeightInput }
