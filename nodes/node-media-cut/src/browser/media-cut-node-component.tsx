import type { VirtualMediaData } from "@gatewai/core/types";
import {
	BaseNode,
	MediaContent,
	useCanvasCtx,
	useNodeResult,
} from "@gatewai/react-canvas";
import {
	makeSelectEdgesByTargetNodeId,
	makeSelectNodeById,
	useAppSelector,
} from "@gatewai/react-store";
import { getActiveMediaMetadata } from "@gatewai/remotion-compositions";
import { Button } from "@gatewai/ui-kit";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaCutConfig } from "../shared/config.js";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const formatTime = (sec: number): string => {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	const ms = Math.floor((sec % 1) * 100);
	if (h > 0)
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
	return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const clamp = (v: number, lo: number, hi: number) =>
	Math.min(Math.max(v, lo), hi);

/* ─────────────────────────────────────────────
   Tick marks
───────────────────────────────────────────── */
function buildTicks(duration: number): number[] {
	if (duration <= 0) return [];
	const rawStep = duration / 8;
	const niceSteps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
	const step = niceSteps.find((s) => s >= rawStep) ?? 300;
	const ticks: number[] = [];
	for (let t = step; t < duration - step * 0.1; t += step) ticks.push(t);
	return ticks;
}

type DragTarget = "start" | "end" | "region";

/* ─────────────────────────────────────────────
   Drag Handle
───────────────────────────────────────────── */
const Handle = memo(
	({
		label,
		pct,
		side,
		dragging,
		onMouseDown,
	}: {
		label: string;
		pct: number;
		side: "start" | "end";
		dragging: boolean;
		onMouseDown: (e: React.MouseEvent) => void;
	}) => (
		<div
			onMouseDown={onMouseDown}
			style={{
				position: "absolute",
				left: `${pct}%`,
				top: 0,
				bottom: 0,
				transform: "translateX(-50%)",
				cursor: dragging ? "grabbing" : "ew-resize",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 10,
				padding: "0 5px",
			}}
		>
			{/* Vertical line */}
			<div
				style={{
					width: 2,
					height: "100%",
					background: dragging
						? "var(--primary)"
						: "color-mix(in oklch, var(--primary) 85%, transparent)",
					borderRadius: 1,
					boxShadow: dragging
						? "0 0 10px color-mix(in oklch, var(--primary) 70%, transparent)"
						: "0 0 5px color-mix(in oklch, var(--primary) 40%, transparent)",
					transition: "box-shadow 0.15s, background 0.15s",
				}}
			/>
			{/* Badge */}
			<div
				style={{
					position: "absolute",
					...(side === "start" ? { top: -20 } : { bottom: -20 }),
					fontFamily: "var(--font-mono)",
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: "0.08em",
					color: "var(--primary)",
					background: "color-mix(in oklch, var(--primary) 12%, transparent)",
					border:
						"1px solid color-mix(in oklch, var(--primary) 35%, transparent)",
					padding: "1px 5px",
					borderRadius: 3,
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</div>
		</div>
	),
);

/* ─────────────────────────────────────────────
   CinematicTimeline
───────────────────────────────────────────── */
interface TimelineProps {
	startSec: number;
	endSec: number | null;
	duration: number;
	onScrub: (start: number, end: number | null) => void;
	onCommit: (start: number, end: number | null) => void;
	onDragChange: (isDragging: boolean) => void;
}

const CinematicTimeline = memo(
	({
		startSec,
		endSec,
		duration,
		onScrub,
		onCommit,
		onDragChange,
	}: TimelineProps) => {
		const barRef = useRef<HTMLDivElement>(null);
		const [dragging, setDragging] = useState<DragTarget | null>(null);
		const [hoveredTime, setHoveredTime] = useState<number | null>(null);

		const dragStartX = useRef(0);
		const dragStartSec = useRef({ start: 0, end: 0 });
		const latestValues = useRef({ start: 0, end: 0 });

		const effectiveEnd = endSec ?? duration;
		const ticks = useMemo(() => buildTicks(duration), [duration]);

		const pct = (sec: number) =>
			duration > 0 ? clamp((sec / duration) * 100, 0, 100) : 0;

		const secFromEvent = useCallback(
			(e: MouseEvent | React.MouseEvent) => {
				const rect = barRef.current?.getBoundingClientRect();
				if (!rect) return 0;
				return clamp(
					((e.clientX - rect.left) / rect.width) * duration,
					0,
					duration,
				);
			},
			[duration],
		);

		// Notify parent of drag state changes
		useEffect(() => {
			onDragChange(dragging !== null);
		}, [dragging, onDragChange]);

		// Initialize/Update latest known good values to avoid stale closures
		// if the user drags and releases quickly.
		useEffect(() => {
			if (!dragging) {
				latestValues.current = { start: startSec, end: effectiveEnd };
			}
		}, [startSec, effectiveEnd, dragging]);

		const onHandleMouseDown = useCallback(
			(e: React.MouseEvent, target: DragTarget) => {
				e.stopPropagation();
				e.preventDefault();
				setDragging(target);
				dragStartX.current = e.clientX;
				dragStartSec.current = { start: startSec, end: effectiveEnd };
				latestValues.current = { start: startSec, end: effectiveEnd };
			},
			[startSec, effectiveEnd],
		);

		// Handle active dragging globally on the window
		useEffect(() => {
			if (!dragging) return;

			const onMove = (e: MouseEvent) => {
				const rect = barRef.current?.getBoundingClientRect();
				if (!rect || rect.width === 0 || duration <= 0) return;

				const dt = ((e.clientX - dragStartX.current) / rect.width) * duration;
				const MIN_GAP = 0.05;

				let ns = dragStartSec.current.start;
				let ne = dragStartSec.current.end;

				if (dragging === "start") {
					ns = clamp(dragStartSec.current.start + dt, 0, ne - MIN_GAP);
				} else if (dragging === "end") {
					ne = clamp(dragStartSec.current.end + dt, ns + MIN_GAP, duration);
				} else if (dragging === "region") {
					const len = dragStartSec.current.end - dragStartSec.current.start;
					ns = dragStartSec.current.start + dt;
					ne = dragStartSec.current.end + dt;

					// Strict boundary clamping for region drag
					if (ns < 0) {
						ns = 0;
						ne = len;
					} else if (ne > duration) {
						ne = duration;
						ns = duration - len;
					}
				}

				// Keep strict local state in the ref for the commit phase
				latestValues.current = { start: ns, end: ne };

				const outEnd = ne >= duration - 0.01 ? null : ne;
				onScrub(ns, outEnd);
			};

			const onUp = () => {
				setDragging(null);
				// Commit to parent/store exactly when the user finishes dragging
				const { start, end } = latestValues.current;
				const outEnd = end >= duration - 0.01 ? null : end;
				onCommit(start, outEnd);
			};

			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);

			return () => {
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
			};
		}, [dragging, duration, onScrub, onCommit]);

		return (
			<div style={{ fontFamily: "var(--font-mono)" }}>
				{/* Hover tooltip row */}
				<div style={{ height: 18, position: "relative", marginBottom: 4 }}>
					{hoveredTime !== null && !dragging && (
						<div
							style={{
								position: "absolute",
								left: `${pct(hoveredTime)}%`,
								transform: "translateX(-50%)",
								fontSize: 9,
								color: "var(--primary)",
								pointerEvents: "none",
								whiteSpace: "nowrap",
								transition: "left 0.03s",
							}}
						>
							{formatTime(hoveredTime)}
						</div>
					)}
				</div>

				{/* Rail */}
				<div
					ref={barRef}
					onMouseMove={(e) => {
						if (!dragging) setHoveredTime(secFromEvent(e));
					}}
					onMouseLeave={() => setHoveredTime(null)}
					style={{
						position: "relative",
						height: 36,
						cursor: dragging ? "grabbing" : "crosshair",
						userSelect: "none",
					}}
				>
					{/* Background track */}
					<div
						style={{
							position: "absolute",
							inset: "14px 0",
							borderRadius: 3,
							background: "var(--muted)",
							border: "1px solid var(--border)",
						}}
					/>

					{/* Film strip segments */}
					<div
						style={{
							position: "absolute",
							inset: "14px 0",
							borderRadius: 3,
							display: "flex",
							overflow: "hidden",
						}}
					>
						{Array.from({ length: 28 }).map((_, i) => (
							<div
								key={i}
								style={{
									flex: 1,
									height: "100%",
									borderRight:
										i < 27
											? "1px solid color-mix(in oklch, var(--border) 50%, transparent)"
											: "none",
								}}
							/>
						))}
					</div>

					{/* Excluded left */}
					{startSec > 0 && (
						<div
							style={{
								position: "absolute",
								left: 0,
								width: `${pct(startSec)}%`,
								top: 14,
								height: 8,
								background:
									"color-mix(in oklch, var(--background) 75%, transparent)",
								borderRadius: "3px 0 0 3px",
							}}
						/>
					)}

					{/* Active selection — draggable */}
					<div
						onMouseDown={(e) => onHandleMouseDown(e, "region")}
						style={{
							position: "absolute",
							left: `${pct(startSec)}%`,
							width: `${pct(effectiveEnd) - pct(startSec)}%`,
							top: 14,
							height: 8,
							background:
								"linear-gradient(90deg, color-mix(in oklch, var(--primary) 75%, transparent), var(--primary), color-mix(in oklch, var(--primary) 75%, transparent))",
							cursor: dragging === "region" ? "grabbing" : "grab",
							boxShadow:
								"0 0 10px color-mix(in oklch, var(--primary) 30%, transparent)",
							borderRadius: 2,
						}}
					/>

					{/* Excluded right */}
					{endSec !== null && endSec < duration && (
						<div
							style={{
								position: "absolute",
								left: `${pct(effectiveEnd)}%`,
								right: 0,
								top: 14,
								height: 8,
								background:
									"color-mix(in oklch, var(--background) 75%, transparent)",
								borderRadius: "0 3px 3px 0",
							}}
						/>
					)}

					{/* Tick marks */}
					{ticks.map((t) => (
						<div
							key={t}
							style={{
								position: "absolute",
								left: `${pct(t)}%`,
								top: 0,
								height: 12,
								width: 1,
								background:
									"color-mix(in oklch, var(--muted-foreground) 35%, transparent)",
								transform: "translateX(-0.5px)",
							}}
						/>
					))}

					{/* Hover cursor line */}
					{hoveredTime !== null && !dragging && (
						<div
							style={{
								position: "absolute",
								left: `${pct(hoveredTime)}%`,
								top: 0,
								bottom: 0,
								width: 1,
								background:
									"color-mix(in oklch, var(--primary) 30%, transparent)",
								pointerEvents: "none",
								transition: "left 0.03s",
							}}
						/>
					)}

					{/* IN handle */}
					<Handle
						label="IN"
						pct={pct(startSec)}
						side="start"
						dragging={dragging === "start"}
						onMouseDown={(e) => onHandleMouseDown(e, "start")}
					/>

					{/* OUT handle */}
					<Handle
						label="OUT"
						pct={pct(effectiveEnd)}
						side="end"
						dragging={dragging === "end"}
						onMouseDown={(e) => onHandleMouseDown(e, "end")}
					/>
				</div>

				{/* Tick labels */}
				<div style={{ position: "relative", height: 18, marginTop: 4 }}>
					{ticks.map((t) => (
						<div
							key={t}
							style={{
								position: "absolute",
								left: `${pct(t)}%`,
								transform: "translateX(-50%)",
								fontSize: 9,
								color: "var(--muted-foreground)",
								opacity: 0.55,
								whiteSpace: "nowrap",
							}}
						>
							{formatTime(t)}
						</div>
					))}
				</div>
			</div>
		);
	},
);

/* ─────────────────────────────────────────────
   TimeStat cell
───────────────────────────────────────────── */
const TimeStat = ({
	label,
	value,
	accent,
}: {
	label: string;
	value: string;
	accent?: boolean;
}) => (
	<div
		style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			gap: 3,
			flex: 1,
		}}
	>
		<span
			style={{
				fontFamily: "var(--font-mono)",
				fontSize: 9,
				letterSpacing: "0.12em",
				textTransform: "uppercase",
				color: accent
					? "color-mix(in oklch, var(--primary) 65%, var(--muted-foreground))"
					: "var(--muted-foreground)",
			}}
		>
			{label}
		</span>
		<span
			style={{
				fontFamily: "var(--font-mono)",
				fontSize: 12,
				fontWeight: 500,
				color: accent ? "var(--primary)" : "var(--foreground)",
				letterSpacing: "0.04em",
			}}
		>
			{value}
		</span>
	</div>
);

/* ─────────────────────────────────────────────
   Main Node
───────────────────────────────────────────── */
const MediaCutNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
		const inputHandleId = useMemo(() => edges?.[0]?.targetHandleId, [edges]);
		const { inputs, result } = useNodeResult(props.id);

		const inputMedia = inputs[inputHandleId!]?.outputItem?.data as
			| VirtualMediaData
			| undefined;
		const inputType = inputs[inputHandleId!]?.outputItem?.type as
			| "Video"
			| "Audio"
			| undefined;

		const sourceMeta = useMemo(() => {
			const activeMeta = getActiveMediaMetadata(inputMedia);
			return {
				width: activeMeta?.width ?? 1920,
				height: activeMeta?.height ?? 1080,
				durationSec: (activeMeta?.durationMs ?? 0) / 1000,
			};
		}, [inputMedia]);

		const node = useAppSelector(makeSelectNodeById(props.id));
		const nodeConfig = node?.config as MediaCutConfig | undefined;

		// Pure local state for lightning-fast UI rendering
		const [startSec, setStartSec] = useState(0);
		const [endSec, setEndSec] = useState<number | null>(null);
		const [isDragging, setIsDragging] = useState(false);

		// Synchronize state from Redux store ONLY if we aren't actively fighting a drag event.
		useEffect(() => {
			if (!isDragging && nodeConfig) {
				setStartSec(nodeConfig.startSec ?? 0);
				setEndSec(nodeConfig.endSec ?? null);
			}
		}, [nodeConfig?.startSec, nodeConfig?.endSec, isDragging]);

		// Used specifically when saving changes to the datastore
		const handleCommit = useCallback(
			(s: number, e: number | null) => {
				setStartSec(s);
				setEndSec(e);
				onNodeConfigUpdate({
					id: props.id,
					newConfig: { startSec: s, endSec: e },
				});
			},
			[props.id, onNodeConfigUpdate],
		);

		// Used for instant UI feedback without saturating the dispatcher
		const handleScrub = useCallback((s: number, e: number | null) => {
			setStartSec(s);
			setEndSec(e);
		}, []);

		const maxDuration = sourceMeta.durationSec || 60;
		const effectiveEnd = endSec ?? maxDuration;
		const trimmedDuration = Math.max(0, effectiveEnd - startSec);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				{/* ── Video preview — no height constraint, controls fully visible ── */}
				<div className="border-b border-border">
					{result && node ? (
						<MediaContent node={node} />
					) : (
						<div
							className="flex flex-col items-center justify-center gap-2"
							style={{ minHeight: 96 }}
						>
							<div className="flex gap-1" style={{ opacity: 0.12 }}>
								{Array.from({ length: 7 }).map((_, i) => (
									<div
										key={i}
										style={{
											width: 16,
											height: 24,
											border: "1px solid var(--foreground)",
											borderRadius: 1,
											position: "relative",
										}}
									>
										<div
											style={{
												position: "absolute",
												inset: 2,
												background: "var(--foreground)",
												opacity: 0.1,
											}}
										/>
									</div>
								))}
							</div>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: 9,
									color: "var(--muted-foreground)",
									letterSpacing: "0.1em",
									opacity: 0.4,
								}}
							>
								NO INPUT CONNECTED
							</span>
						</div>
					)}
				</div>

				{/* ── Stats row ── */}
				<div
					className="flex border-b border-border"
					style={{ padding: "10px 14px" }}
				>
					<TimeStat label="In" value={formatTime(startSec)} />
					<div
						style={{ width: 1, background: "var(--border)", margin: "0 4px" }}
					/>
					<TimeStat
						label="Duration"
						value={formatTime(trimmedDuration)}
						accent
					/>
					<div
						style={{ width: 1, background: "var(--border)", margin: "0 4px" }}
					/>
					<TimeStat
						label="Out"
						value={
							endSec !== null ? formatTime(endSec) : formatTime(maxDuration)
						}
					/>
				</div>

				{/* ── Timeline ── */}
				<div style={{ padding: "16px 16px 10px" }}>
					<CinematicTimeline
						startSec={startSec}
						endSec={endSec}
						duration={maxDuration}
						onScrub={handleScrub}
						onCommit={handleCommit}
						onDragChange={setIsDragging}
					/>
				</div>

				{/* ── Footer ── */}
				<div className="flex justify-end" style={{ padding: "0 16px 12px" }}>
					<Button variant="ghost" size="sm" className="text-muted-foreground">
						Reset
					</Button>
				</div>
			</BaseNode>
		);
	},
);

export { MediaCutNodeComponent };
