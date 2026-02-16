import type { ModulateNodeConfig } from "@gatewai/node-modulate";
import { useCanvasCtx } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { Label, Slider } from "@gatewai/ui-kit";
import { debounce } from "lodash";
import { memo, useMemo } from "react";

const ModulateNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
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
							Hue
						</Label>
						<span className="text-[10px] font-medium">
							{Math.round(config.hue ?? 0)}°
						</span>
					</div>
					<Slider
						value={[config.hue ?? 0]}
						min={0}
						max={360}
						step={1}
						onValueChange={([val]) => updateConfig({ hue: val })}
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
						max={3}
						step={0.01}
						onValueChange={([val]) => updateConfig({ saturation: val })}
					/>
				</div>

				<div className="flex flex-col gap-2 scale-90 origin-left">
					<div className="flex justify-between items-center">
						<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Lightness
						</Label>
						<span className="text-[10px] font-medium">
							{Math.round((config.lightness ?? 1) * 100)}%
						</span>
					</div>
					<Slider
						value={[config.lightness ?? 1]}
						min={0}
						max={3}
						step={0.01}
						onValueChange={([val]) => updateConfig({ lightness: val })}
					/>
				</div>

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
						max={3}
						step={0.01}
						onValueChange={([val]) => updateConfig({ brightness: val })}
					/>
				</div>
			</div>
		);
	},
);

export { ModulateNodeConfigComponent };
