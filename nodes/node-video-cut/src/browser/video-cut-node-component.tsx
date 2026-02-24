import type { VirtualVideoData } from "@gatewai/core/types";
import {
	BaseNode,
	MediaContent,
	useCanvasCtx,
	useNodeResult,
	VideoRenderer,
} from "@gatewai/react-canvas";
import {
	makeSelectEdgesByTargetNodeId,
	makeSelectNodeById,
	useAppSelector,
} from "@gatewai/react-store";
import { getActiveVideoMetadata } from "@gatewai/remotion-compositions";
import { Slider } from "@gatewai/ui-kit";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { VideoCutConfig } from "../shared/config.js";

const formatTime = (sec: number): string => {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	const ms = Math.floor((sec % 1) * 100);

	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
	}
	return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const VideoCutNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
		const inputHandleId = useMemo(() => edges?.[0]?.targetHandleId, [edges]);
		const { inputs, result } = useNodeResult(props.id);

		const inputVideo = inputs[inputHandleId!]?.outputItem?.data as
			| VirtualVideoData
			| undefined;

		const sourceMeta = useMemo(() => {
			const activeMeta = getActiveVideoMetadata(inputVideo);
			return {
				width: activeMeta.width ?? 1920,
				height: activeMeta.height ?? 1080,
				durationSec: (activeMeta.durationMs ?? 0) / 1000,
			};
		}, [inputVideo]);

		const node = useAppSelector(makeSelectNodeById(props.id));
		const nodeConfig = node?.config as VideoCutConfig | undefined;

		const [startSec, setStartSec] = useState(0);
		const [endSec, setEndSec] = useState<number | null>(null);

		useEffect(() => {
			if (nodeConfig) {
				setStartSec(nodeConfig.startSec ?? 0);
				setEndSec(nodeConfig.endSec);
			}
		}, [nodeConfig?.startSec, nodeConfig?.endSec]);

		const updateConfig = useCallback(
			(newConfig: { startSec: number; endSec: number | null }) =>
				onNodeConfigUpdate({ id: props.id, newConfig }),
			[props.id, onNodeConfigUpdate],
		);

		const handleStartChange = useCallback(
			(value: number[]) => {
				const newStart = value[0];
				setStartSec(newStart);
				updateConfig({ startSec: newStart, endSec });
			},
			[endSec, updateConfig],
		);

		const handleEndChange = useCallback(
			(value: number[]) => {
				const newEnd = value[0];
				setEndSec(newEnd);
				updateConfig({ startSec, endSec: newEnd });
			},
			[startSec, updateConfig],
		);

		const trimmedDurationMs = useMemo(() => {
			const end = endSec ?? sourceMeta.durationSec;
			return Math.max(0, (end - startSec) * 1000);
		}, [startSec, endSec, sourceMeta.durationSec]);

		const maxDuration = sourceMeta.durationSec || 60;

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="select-none rounded-xl overflow-hidden bg-card border border-border">
					<div
						className="relative min-h-32"
						
					>
						{result && node ? (
							<MediaContent node={node} result={result} />
						) : (
							<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs italic border-b border-white/10 w-full h-full">
								No input connected
							</div>
						)}
					</div>

					<div className="p-4 space-y-4">
						<div className="space-y-2">
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">Start</span>
								<span className="font-mono">{formatTime(startSec)}</span>
							</div>
							<Slider
								value={[startSec]}
								min={0}
								max={maxDuration}
								step={0.01}
								onValueChange={handleStartChange}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">End</span>
								<span className="font-mono">
									{endSec !== null ? formatTime(endSec) : "End"}
								</span>
							</div>
							<Slider
								value={[endSec ?? maxDuration]}
								min={0}
								max={maxDuration}
								step={0.01}
								onValueChange={handleEndChange}
							/>
						</div>

						<div className="text-xs text-muted-foreground text-center pt-2 border-t">
							Duration: {formatTime(trimmedDurationMs / 1000)}
						</div>
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoCutNodeComponent };
