import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppDispatch } from "@/store";
import { type NodeEntityType, updateNodeConfig } from "@/store/nodes";
import type { ResizeNodeConfig } from "@gatewai/types";
import { memo, useCallback } from "react";


const AspectRatioSwitch = memo(({node, originalWidth, originalHeight}: {node: NodeEntityType, originalWidth: number | null, originalHeight: number | null}) => {
  const config = node.config as ResizeNodeConfig & { maintainAspect?: boolean };
  const maintainAspect = config.maintainAspect ?? true;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((checked: boolean) => {
    let updates: Partial<ResizeNodeConfig & { maintainAspect: boolean }> = { maintainAspect: checked };
    if (checked && originalWidth && originalHeight) {
      const currentWidth = config.width ?? originalWidth;
      const newHeight = Math.round((originalHeight / originalWidth) * currentWidth);
      updates = { ...updates, height: newHeight };
    }
    
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: updates
    }));
  }, [dispatch, node.id, originalWidth, originalHeight, config.width]);
  
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="maintain-aspect"
        checked={maintainAspect}
        onCheckedChange={handleChange}
      />
      <Label htmlFor="maintain-aspect">Keep scaling</Label>
    </div>
  );
});

export { AspectRatioSwitch }
