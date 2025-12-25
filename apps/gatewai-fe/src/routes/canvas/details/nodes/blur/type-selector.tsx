import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppDispatch } from "@/store";
import { type NodeEntityType, updateNodeConfig } from "@/store/nodes";
import { type BlurNodeConfig, BLUR_TYPES } from "@gatewai/types";
import { memo, useCallback } from "react";

const BlurTypeSelector = memo(({node}: {node: NodeEntityType}) => {
  const config = node?.config as BlurNodeConfig;
  const dispatch = useAppDispatch();
  
  const handleChange = useCallback((blurType: string) => {
    dispatch(updateNodeConfig({
      id: node.id,
      newConfig: { blurType }
    }));
  }, [dispatch, node.id]);
  
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
