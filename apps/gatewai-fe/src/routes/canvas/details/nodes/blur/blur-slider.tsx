import { Slider } from "@/components/ui/slider";
import { type NodeEntityType } from "@/store/nodes";
import type { BlurNodeConfig } from "@gatewai/types";
import { memo, useCallback, useEffect, useState } from "react";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { Label } from "@/components/ui/label";

const BlurValueSlider = memo(({node}: {node: NodeEntityType}) => {
  const config: BlurNodeConfig = node.config as BlurNodeConfig;
  const [localSize, setLocalSize] = useState(config.size ?? 0);
  const { onNodeConfigUpdate } = useCanvasCtx();
  
  useEffect(() => {
    setLocalSize(config.size ?? 0);
  }, [config.size]);

  const handleChange = useCallback((value: number[]) => {
    setLocalSize(value[0]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onNodeConfigUpdate({
        id: node.id,
        newConfig: { size: localSize }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [localSize, node.id, onNodeConfigUpdate]);
  
  return (
    <div className="flex gap-2 flex-1">
      <Label className="text-xs text-gray-600">Size</Label>
      <Slider
        value={[localSize]}
        max={100}
        min={1}
        step={1}
        onValueChange={handleChange}
      />
    </div>
  );
});

export { BlurValueSlider }