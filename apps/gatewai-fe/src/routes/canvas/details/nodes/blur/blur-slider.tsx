import { Slider } from "@/components/ui/slider";
import { useAppDispatch } from "@/store";
import { type NodeEntityType, updateNodeConfig } from "@/store/nodes";
import type { BlurNodeConfig } from "@gatewai/types";
import { memo, useCallback } from "react";

const BlurValueSlider = memo(({node}: {node: NodeEntityType}) => {
  const config: BlurNodeConfig = node.config as BlurNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((value: number[]) => {
    dispatch(updateNodeConfig({
        id: node.id,
        newConfig: { size: value[0] }
    }));
  }, [dispatch, node.id]);
  
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs text-gray-600">Blur Size: {config.size ?? 0}</label>
      <Slider
        value={[config.size ?? 0]}
        max={20}
        min={0}
        step={1}
        onValueChange={handleChange}
      />
    </div>
  );
});

export { BlurValueSlider }
