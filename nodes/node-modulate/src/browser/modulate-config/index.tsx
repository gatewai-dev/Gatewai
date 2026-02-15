import type { ModulateNodeConfig } from "@gatewai/node-modulate";
import type { NodeEntityType } from "@gatewai/react-store";
import { Label, Slider } from "@gatewai/ui-kit";
import { debounce } from "lodash";
import { memo, useMemo } from "react";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";

const ModulateNodeConfigComponent = memo(({ node }: { node: NodeEntityType }) => {
    const { onNodeConfigUpdate } = useCanvasCtx();
    const updateConfig = useMemo(
        () =>
            debounce((cfg: Partial<ModulateNodeConfig>) => {
                onNodeConfigUpdate({ id: node.id, newConfig: cfg });
            }, 500),
        [node.id, onNodeConfigUpdate],
    );

    const config = node.config as ModulateNodeConfig;

    return (
        <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-col gap-2 scale-90 origin-left">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Brightness
                    </Label>
                    <span className="text-[10px] font-medium">
                        {Math.round((config.brightness ?? 1) * 100)}%
                    </span>
                </div>
                <Slider
                    value={[config.brightness ?? 1]}
                    min={0}
                    max={2}
                    step={0.01}
                    onValueChange={([val]) => updateConfig({ brightness: val })}
                />
            </div>

            <div className="flex flex-col gap-2 scale-90 origin-left">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Contrast
                    </Label>
                    <span className="text-[10px] font-medium">
                        {Math.round((config.contrast ?? 1) * 100)}%
                    </span>
                </div>
                <Slider
                    value={[config.contrast ?? 1]}
                    min={0}
                    max={2}
                    step={0.01}
                    onValueChange={([val]) => updateConfig({ contrast: val })}
                />
            </div>

            <div className="flex flex-col gap-2 scale-90 origin-left">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Saturation
                    </Label>
                    <span className="text-[10px] font-medium">
                        {Math.round((config.saturation ?? 1) * 100)}%
                    </span>
                </div>
                <Slider
                    value={[config.saturation ?? 1]}
                    min={0}
                    max={2}
                    step={0.01}
                    onValueChange={([val]) => updateConfig({ saturation: val })}
                />
            </div>
        </div>
    );
});

ModulateNodeConfigComponent.displayName = "ModulateNodeConfig";

export { ModulateNodeConfigComponent };
