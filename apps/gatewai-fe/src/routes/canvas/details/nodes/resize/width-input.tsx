import { Input } from "@/components/ui/input";
import { useAppDispatch } from "@/store";
import { type NodeEntityType, updateNodeConfig } from "@/store/nodes";
import type { ResizeNodeConfig } from "@gatewai/types";
import { memo, useCallback } from "react";

const ResizeWidthInput = memo((
  {node, originalWidth, originalHeight, maintainAspect}:
  {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null, maintainAspect: boolean}
) => {
  const config: ResizeNodeConfig = node.config as ResizeNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valueStr = e.target.value;
    if (valueStr === '') return;
    const value = parseInt(valueStr, 10);
    if (isNaN(value) || value < 1 || value > 2000) return;
    
    let updates: Partial<ResizeNodeConfig> = { width: value };
    if (maintainAspect && originalWidth && originalHeight) {
      const newHeight = Math.round((originalHeight / originalWidth) * value);
      updates = { ...updates, height: newHeight };
    }
    
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: updates
    }));
  }, [dispatch, node.id, maintainAspect, originalWidth, originalHeight]);
  
  const displayValue = config.width ?? originalWidth ?? 0;
  
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs text-gray-600">Width: {displayValue}</label>
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

export { ResizeWidthInput }
