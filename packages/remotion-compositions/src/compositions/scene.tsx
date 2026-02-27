import type {
	ExtendedLayer,
	VideoAnimation,
	VirtualMediaData,
} from "@gatewai/core/types";
import { Stage, useGLTF } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import type { LottieAnimationData } from "@remotion/lottie";
import { Lottie } from "@remotion/lottie";
import { Audio, Video } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import type React from "react";
import {
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AbsoluteFill,
	cancelRender,
	continueRender,
	delayRender,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
	buildCSSFilterString,
	computeRenderParams,
} from "../utils/apply-operations.js";
import {
	getActiveMediaMetadata,
	getMediaType,
} from "../utils/resolve-video.js";

const DEFAULT_DURATION_FRAMES = 24 * 5;

const CameraSetup = () => {
	const camera = useThree((state) => state.camera);
	useEffect(() => {
		camera.position.set(0, 0, 10);
		camera.near = 0.1;
		camera.far = 10000;
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();
	}, [camera]);
	return null;
};

// 2. Deterministic Centering & Scaling (Replaces <Stage>)
const AutoCenterModel = ({ children }: { children: React.ReactNode }) => {
	const groupRef = useRef<THREE.Group>(null);
	const wrapperRef = useRef<THREE.Group>(null);

	useLayoutEffect(() => {
		// ← was useEffect
		if (groupRef.current && wrapperRef.current) {
			const box = new THREE.Box3().setFromObject(groupRef.current);
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3());

			groupRef.current.position.set(-center.x, -center.y, -center.z);

			const maxDim = Math.max(size.x, size.y, size.z);
			if (maxDim > 0) {
				wrapperRef.current.scale.setScalar(6 / maxDim);
			}
		}
	}, [children]);

	return (
		<group ref={wrapperRef}>
			<group ref={groupRef}>{children}</group>
		</group>
	);
};
// ---------------------------------------------------------------------------
// 3D Rendering Component
// ---------------------------------------------------------------------------

function OBJModel({ url }: { url: string }) {
	const obj = useLoader(OBJLoader, url);
	return <primitive object={obj} />;
}

function STLModel({ url }: { url: string }) {
	const stl = useLoader(STLLoader, url);
	useEffect(() => {
		stl.computeVertexNormals();
	}, [stl]);
	return (
		<mesh geometry={stl}>
			<meshStandardMaterial color="#cccccc" />
		</mesh>
	);
}

function GLTFModel({ url }: { url: string }) {
	const gltf = useGLTF(url);
	const objectToRender = gltf.scene || gltf.scenes?.[0];
	if (!objectToRender) return null;
	return <primitive object={objectToRender} />;
}

function Model({ url, mimeType }: { url: string; mimeType?: string }) {
	const extension = useMemo(() => {
		if (mimeType === "model/stl") return "stl";
		if (mimeType === "model/obj") return "obj";
		if (mimeType?.includes("gltf") || mimeType?.includes("glb")) return "gltf";
		try {
			return new URL(url).pathname.split(".").pop()?.toLowerCase();
		} catch {
			return url.split(".").pop()?.toLowerCase();
		}
	}, [url, mimeType]);

	if (extension === "obj") return <OBJModel url={url} />;
	if (extension === "stl") return <STLModel url={url} />;
	return <GLTFModel url={url} />;
}

function ModelLoadController({
	url,
	mimeType,
}: {
	url: string;
	mimeType?: string;
}) {
	// 1. Grab a lock immediately before the child components Suspend
	const [handle] = useState(() => delayRender(`Loading 3D Model: ${url}`));

	// 2. React only runs this effect AFTER Suspense resolves and the component mounts
	useEffect(() => {
		continueRender(handle);
		return () => continueRender(handle); // Failsafe cleanup
	}, [handle]);

	const extension = useMemo(() => {
		if (mimeType === "model/stl") return "stl";
		if (mimeType === "model/obj") return "obj";
		if (mimeType?.includes("gltf") || mimeType?.includes("glb")) return "gltf";

		try {
			const path = new URL(url).pathname;
			return path.split(".").pop()?.toLowerCase();
		} catch (e) {
			return url.split(".").pop()?.toLowerCase();
		}
	}, [url, mimeType]);

	if (extension === "obj") return <OBJModel url={url} />;
	if (extension === "stl") return <STLModel url={url} />;
	return <GLTFModel url={url} />;
}

const ThreeDFromUrl: React.FC<{
	src: string;
	style?: React.CSSProperties;
	mimeType?: string;
	width: number; // ← add
	height: number; // ← add
}> = ({ src, style, mimeType, width, height }) => {
	return (
		<div style={{ ...style, position: "absolute", inset: 0 }}>
			{/* 'linear' flag like the template to fix color space issues */}
			<ThreeCanvas linear width={width} height={height}>
				<CameraSetup />
				<ambientLight intensity={1.5} color={0xffffff} />
				<pointLight position={[10, 10, 10]} />
				<Suspense fallback={null}>
					<AutoCenterModel>
						<Model url={src} mimeType={mimeType} />
					</AutoCenterModel>
				</Suspense>
			</ThreeCanvas>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Format Detection helpers
// ---------------------------------------------------------------------------

const isLottieSource = (virtualMedia: VirtualMediaData): boolean => {
	const op = virtualMedia?.operation;
	if (!op || op.op !== "source") return false;
	const src = op.source;
	if (!src) return false;
	const mimeType: string =
		src.processData?.mimeType ?? src.entity?.mimeType ?? "";
	if (mimeType === "application/json") return true;
	const key: string = src.entity?.key ?? src.entity?.name ?? "";
	if (key.toLowerCase().endsWith(".json")) return true;
	return false;
};

const isThreeDSource = (virtualMedia: VirtualMediaData): boolean => {
	const op = virtualMedia?.operation;
	if (!op || op.op !== "source") return false;
	const src = op.source;
	if (!src) return false;
	const mimeType: string =
		src.processData?.mimeType ?? src.entity?.mimeType ?? "";

	// Check for standard 3D MIME types
	if (
		mimeType.includes("model/gltf") ||
		mimeType.includes("model/obj") ||
		mimeType.includes("model/stl")
	)
		return true;

	const key: string = src.entity?.key ?? src.entity?.name ?? "";
	const ext = key.toLowerCase();
	if (
		ext.endsWith(".glb") ||
		ext.endsWith(".gltf") ||
		ext.endsWith(".obj") ||
		ext.endsWith(".stl")
	)
		return true;

	return false;
};

// ---------------------------------------------------------------------------
// LottieFromUrl
// ---------------------------------------------------------------------------

interface LottieFromUrlProps {
	src: string;
	style?: React.CSSProperties;
	loop?: boolean;
	playbackRate?: number;
}

const LottieFromUrl: React.FC<LottieFromUrlProps> = ({
	src,
	style,
	loop = true,
	playbackRate = 1,
}) => {
	const [animationData, setAnimationData] =
		useState<LottieAnimationData | null>(null);
	const handleRef = useRef<number | null>(null);

	useEffect(() => {
		handleRef.current = delayRender(`Loading Lottie from: ${src}`);
		let cancelled = false;

		fetch(src)
			.then((res) => {
				if (!res.ok)
					throw new Error(
						`Failed to fetch Lottie file: ${res.status} ${res.statusText}`,
					);
				return res.json() as Promise<LottieAnimationData>;
			})
			.then((data) => {
				if (cancelled) return;
				setAnimationData(data);
				if (handleRef.current !== null) {
					continueRender(handleRef.current);
					handleRef.current = null;
				}
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				cancelRender(err instanceof Error ? err : new Error(String(err)));
			});

		return () => {
			cancelled = true;
			if (handleRef.current !== null) {
				continueRender(handleRef.current);
				handleRef.current = null;
			}
		};
	}, [src]);

	if (!animationData)
		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					...style,
				}}
			/>
		);
	return (
		<Lottie
			animationData={animationData}
			loop={loop}
			playbackRate={playbackRate}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				...style,
			}}
		/>
	);
};

export const calculateLayerTransform = (
	layer: ExtendedLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - (layer.startFrame ?? 0);
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale ?? 1;
	let rotation = layer.rotation;
	let opacity = layer.opacity ?? 1;
	const volume = layer.volume ?? 1;
	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
	const animations = layer.animations ?? [];
	if (animations.length === 0)
		return { x, y, scale, rotation, opacity, volume };

	animations.forEach((anim) => {
		const durFrames = anim.value * fps;
		const isOut = anim.type.includes("-out");
		const startAnimFrame = isOut ? duration - durFrames : 0;
		const endAnimFrame = isOut ? duration : durFrames;
		if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) return;

		const progress = interpolate(
			relativeFrame,
			[startAnimFrame, endAnimFrame],
			[0, 1],
			{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
		);
		switch (anim.type) {
			case "fade-in":
				opacity *= progress;
				break;
			case "fade-out":
				opacity *= 1 - progress;
				break;
			case "slide-in-left":
				x += -1 * viewport.w * (1 - progress);
				break;
			case "slide-in-right":
				x += 1 * viewport.w * (1 - progress);
				break;
			case "slide-in-top":
				y += -1 * viewport.h * (1 - progress);
				break;
			case "slide-in-bottom":
				y += 1 * viewport.h * (1 - progress);
				break;
			case "zoom-in":
				scale *= interpolate(progress, [0, 1], [0, 1]);
				break;
			case "zoom-out":
				scale *= interpolate(progress, [0, 1], [1, 0]);
				break;
			case "rotate-cw":
				rotation += 360 * progress;
				break;
			case "rotate-ccw":
				rotation += -360 * progress;
				break;
			case "bounce": {
				const bounceVal = spring({
					frame: relativeFrame - startAnimFrame,
					fps,
					config: { damping: 10, mass: 0.5, stiffness: 100 },
					durationInFrames: durFrames,
				});
				scale *= bounceVal;
				break;
			}
			case "shake": {
				const intensity = 20;
				x +=
					intensity *
					Math.sin((relativeFrame * 10 * 2 * Math.PI) / durFrames) *
					(1 - progress);
				break;
			}
		}
	});

	return { x, y, scale, rotation, opacity, volume };
};

const compareVirtualMedia = (
	a: VirtualMediaData | undefined,
	b: VirtualMediaData | undefined,
): boolean => {
	if (a === b) return true;
	if (!a || !b) return false;
	const aOp = a.operation;
	const bOp = b.operation;
	if (aOp?.op !== bOp?.op) return false;

	switch (aOp.op) {
		case "source": {
			if (bOp.op !== "source") return false;
			if (aOp.source?.processData?.dataUrl !== bOp.source?.processData?.dataUrl)
				return false;
			break;
		}
		case "text": {
			if (bOp.op !== "text") return false;
			if (aOp.text !== bOp.text) return false;
			break;
		}
		case "crop": {
			if (bOp.op !== "crop") return false;
			const isDifferent =
				aOp.leftPercentage !== bOp.leftPercentage ||
				aOp.topPercentage !== bOp.topPercentage ||
				aOp.widthPercentage !== bOp.widthPercentage ||
				aOp.heightPercentage !== bOp.heightPercentage;
			if (isDifferent) return false;
			break;
		}
		case "cut": {
			if (bOp.op !== "cut") return false;
			if (aOp.startSec !== bOp.startSec || aOp.endSec !== bOp.endSec)
				return false;
			break;
		}
		case "filter": {
			if (bOp.op !== "filter") return false;
			if (
				JSON.stringify(aOp.filters.cssFilters) !==
				JSON.stringify(bOp.filters.cssFilters)
			)
				return false;
			break;
		}
		case "layer": {
			if (bOp.op !== "layer") return false;
			if (
				aOp.x !== bOp.x ||
				aOp.y !== bOp.y ||
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.rotation !== bOp.rotation ||
				aOp.scale !== bOp.scale ||
				aOp.opacity !== bOp.opacity ||
				aOp.startFrame !== bOp.startFrame ||
				aOp.durationInFrames !== bOp.durationInFrames ||
				aOp.zIndex !== bOp.zIndex ||
				aOp.text !== bOp.text ||
				aOp.fontSize !== bOp.fontSize ||
				aOp.fontFamily !== bOp.fontFamily ||
				aOp.fontStyle !== bOp.fontStyle ||
				aOp.fontWeight !== bOp.fontWeight ||
				aOp.textDecoration !== bOp.textDecoration ||
				aOp.fill !== bOp.fill ||
				aOp.align !== bOp.align ||
				aOp.verticalAlign !== bOp.verticalAlign ||
				aOp.letterSpacing !== bOp.letterSpacing ||
				aOp.lineHeight !== bOp.lineHeight ||
				aOp.padding !== bOp.padding ||
				aOp.stroke !== bOp.stroke ||
				aOp.strokeWidth !== bOp.strokeWidth ||
				aOp.backgroundColor !== bOp.backgroundColor ||
				aOp.borderColor !== bOp.borderColor ||
				aOp.borderWidth !== bOp.borderWidth ||
				aOp.borderRadius !== bOp.borderRadius ||
				aOp.autoDimensions !== bOp.autoDimensions ||
				aOp.speed !== bOp.speed ||
				aOp.lottieLoop !== bOp.lottieLoop ||
				aOp.lottieFrameRate !== bOp.lottieFrameRate ||
				aOp.lottieDurationMs !== bOp.lottieDurationMs ||
				JSON.stringify(aOp.animations) !== JSON.stringify(bOp.animations)
			)
				return false;
			break;
		}
		case "compose": {
			if (bOp.op !== "compose") return false;
			if (
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.fps !== bOp.fps ||
				aOp.durationInFrames !== bOp.durationInFrames
			)
				return false;
			if (a.children.length !== b.children.length) return false;
			for (let i = 0; i < a.children.length; i++) {
				if (!compareVirtualMedia(a.children[i], b.children[i])) return false;
			}
			return true;
		}
	}

	if (
		a.metadata.width !== b.metadata.width ||
		a.metadata.height !== b.metadata.height ||
		a.metadata.fps !== b.metadata.fps ||
		a.metadata.durationMs !== b.metadata.durationMs
	)
		return false;
	if (a.children.length !== b.children.length) return false;
	if (a.children.length > 0)
		return compareVirtualMedia(a.children[0], b.children[0]);
	return true;
};

export const SingleClipComposition: React.FC<{
	virtualMedia: VirtualMediaData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
	textStyle?: Partial<ExtendedLayer>;
	containerWidth: number;
	containerHeight: number;
}> = ({
	virtualMedia,
	volume = 1,
	playbackRateOverride,
	trimStartOverride,
	textStyle,
	containerWidth,
	containerHeight,
}) => {
	const { fps } = useVideoConfig();
	const op = virtualMedia?.operation;

	if (op.op === "compose") {
		const composeNode = (
			<CompositionScene
				layers={
					(virtualMedia.children || [])
						.map((child, index) => {
							if (child.operation?.op === "layer") {
								const lop = child.operation;
								const contentType = getMediaType(child.children[0]);
								return {
									id: `child-${index}`,
									type: contentType,
									virtualMedia: child.children[0],
									x: lop.x,
									y: lop.y,
									width: lop.width,
									height: lop.height,
									rotation: lop.rotation,
									scale: lop.scale,
									opacity: lop.opacity,
									startFrame: lop.startFrame,
									durationInFrames: lop.durationInFrames ?? 1,
									zIndex: lop.zIndex,
									trimStart: lop.trimStart,
									trimEnd: lop.trimEnd,
									speed: lop.speed,
									text: lop.text,
									fontSize: lop.fontSize,
									fontFamily: lop.fontFamily,
									fontStyle: lop.fontStyle,
									fontWeight: lop.fontWeight,
									textDecoration: lop.textDecoration,
									fill: lop.fill,
									align: lop.align,
									verticalAlign: lop.verticalAlign,
									letterSpacing: lop.letterSpacing,
									lineHeight: lop.lineHeight,
									padding: lop.padding,
									stroke: lop.stroke,
									strokeWidth: lop.strokeWidth,
									backgroundColor: lop.backgroundColor,
									borderColor: lop.borderColor,
									borderWidth: lop.borderWidth,
									borderRadius: lop.borderRadius,
									autoDimensions: lop.autoDimensions,
									lottieLoop: lop.lottieLoop,
									lottieFrameRate: lop.lottieFrameRate,
									lottieDurationMs: lop.lottieDurationMs,
									animations: lop.animations,
								} as ExtendedLayer;
							}
							return null;
						})
						.filter(Boolean) as ExtendedLayer[]
				}
				viewportWidth={op.width}
				viewportHeight={op.height}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
		const trimFrames = trimStartOverride
			? Math.floor(trimStartOverride * fps)
			: 0;
		if (trimFrames > 0)
			return (
				<Sequence from={-trimFrames} layout="none">
					{composeNode}
				</Sequence>
			);
		return composeNode;
	}

	if (op.op === "source" || op.op === "text") {
		const params = computeRenderParams(virtualMedia);

		if (isThreeDSource(virtualMedia)) {
			if (!params.sourceUrl) return <AbsoluteFill />;
			const baseRate = Number(playbackRateOverride) || 1;
			const paramsRate = Number(params.speed) || 1;
			const finalPlaybackRate = baseRate * paramsRate;

			return (
				<ThreeDFromUrl
					src={params.sourceUrl}
					playbackRate={finalPlaybackRate}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			);
		}

		if (isLottieSource(virtualMedia)) {
			if (!params.sourceUrl) return <AbsoluteFill />;
			const baseRate = Number(playbackRateOverride) || 1;
			const paramsRate = Number(params.speed) || 1;
			const finalPlaybackRate = baseRate * paramsRate;
			const lottieLoop = textStyle?.lottieLoop ?? true;

			return (
				<LottieFromUrl
					src={params.sourceUrl}
					loop={lottieLoop}
					playbackRate={finalPlaybackRate}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			);
		}

		const mediaType = getMediaType(virtualMedia);

		if (mediaType === "Text") {
			const mergedStyle = { ...textStyle, ...(op as any) };
			const textContent =
				op.op === "text"
					? op.text
					: op.op === "source"
						? op.source?.processData?.text
						: undefined;
			return (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						flexDirection: "column",
						alignItems: "stretch",
						justifyContent:
							mergedStyle.verticalAlign === "middle"
								? "center"
								: mergedStyle.verticalAlign === "bottom"
									? "flex-end"
									: "flex-start",
						color: mergedStyle.fill,
						fontSize: mergedStyle.fontSize,
						fontFamily: mergedStyle.fontFamily,
						fontStyle: mergedStyle.fontStyle,
						fontWeight: mergedStyle.fontWeight,
						textDecoration: mergedStyle.textDecoration,
						textAlign: (mergedStyle.align as any) ?? "center",
						padding: mergedStyle.padding,
						lineHeight: mergedStyle.lineHeight ?? 1.2,
						letterSpacing: mergedStyle.letterSpacing
							? `${mergedStyle.letterSpacing}px`
							: undefined,
						WebkitTextStroke:
							mergedStyle.strokeWidth && mergedStyle.stroke
								? `${mergedStyle.strokeWidth}px ${mergedStyle.stroke}`
								: undefined,
						paintOrder: "stroke fill",
						whiteSpace: "pre",
					}}
				>
					{textContent}
				</div>
			);
		}

		if (!params.sourceUrl) return <AbsoluteFill />;

		const baseRate = Number(playbackRateOverride) || 1;
		const paramsRate = Number(params.speed) || 1;
		const finalPlaybackRate = baseRate * paramsRate;
		const effectiveTrimSec =
			(trimStartOverride ?? 0) + (Number(params.trimStartSec) || 0);
		const startFrame = Math.floor(effectiveTrimSec * fps);

		if (mediaType === "Audio")
			return (
				<Audio
					src={params.sourceUrl}
					trimBefore={startFrame}
					playbackRate={finalPlaybackRate}
					volume={volume}
				/>
			);
		if (mediaType === "Image")
			return (
				<Img
					src={params.sourceUrl}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						objectFit: "fill",
					}}
				/>
			);
		if (mediaType === "Lottie") {
			const lottieLoop = textStyle?.lottieLoop ?? true;
			return (
				<LottieFromUrl
					src={params.sourceUrl}
					loop={lottieLoop}
					playbackRate={finalPlaybackRate}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			);
		}

		return (
			<Video
				src={params.sourceUrl}
				playbackRate={finalPlaybackRate}
				trimBefore={startFrame}
				volume={volume}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					objectFit: "fill",
					display: "block",
				}}
			/>
		);
	}

	if (op.op === "speed") {
		const childVideo = virtualMedia.children[0];
		if (!childVideo) return null;
		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={
					(Number(playbackRateOverride) || 1) * (Number(op.rate) || 1)
				}
				trimStartOverride={trimStartOverride}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}
	if (op.op === "cut") {
		const childVideo = virtualMedia.children[0];
		if (!childVideo) return null;
		const accumulatedTrim = (trimStartOverride ?? 0) + (op.startSec ?? 0);
		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={accumulatedTrim}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}

	const childVideo = virtualMedia.children[0];
	let childContainerWidth = containerWidth;
	let childContainerHeight = containerHeight;
	if (op.op === "crop") {
		const wp = Math.max(0.01, Number(op.widthPercentage) || 100);
		const hp = Math.max(0.01, Number(op.heightPercentage) || 100);
		childContainerWidth = containerWidth * (100 / wp);
		childContainerHeight = containerHeight * (100 / hp);
	}
	const content = childVideo ? (
		<SingleClipComposition
			virtualMedia={childVideo}
			volume={volume}
			playbackRateOverride={playbackRateOverride}
			trimStartOverride={trimStartOverride}
			textStyle={
				op.op === "layer" ? { ...textStyle, ...(op as any) } : textStyle
			}
			containerWidth={childContainerWidth}
			containerHeight={childContainerHeight}
		/>
	) : null;

	if (op.op === "crop") {
		const wp = Math.max(0.01, Number(op.widthPercentage) || 100);
		const hp = Math.max(0.01, Number(op.heightPercentage) || 100);
		const lp = Number(op.leftPercentage) || 0;
		const tp = Number(op.topPercentage) || 0;
		const innerWidth = (100 / wp) * 100;
		const innerHeight = (100 / hp) * 100;
		const innerLeft = (lp / wp) * 100;
		const innerTop = (tp / hp) * 100;
		const innerStyle: React.CSSProperties = {
			position: "absolute",
			width: `${innerWidth}%`,
			height: `${innerHeight}%`,
			left: `-${innerLeft}%`,
			top: `-${innerTop}%`,
		};
		return (
			<AbsoluteFill style={{ overflow: "hidden" }}>
				<div style={innerStyle} key={`crop-${wp}-${hp}-${lp}-${tp}`}>
					<AbsoluteFill>{content}</AbsoluteFill>
				</div>
			</AbsoluteFill>
		);
	}

	let transformStr: string | undefined;
	let cssFilterString: string | undefined;
	if (op.op === "rotate") {
		transformStr = `rotate(${(op as any).degrees}deg)`;
	} else if (op.op === "flip") {
		const transforms = [];
		if (op.horizontal) transforms.push("scaleX(-1)");
		if (op.vertical) transforms.push("scaleY(-1)");
		transformStr = transforms.length ? transforms.join(" ") : undefined;
	} else if (op.op === "filter") {
		cssFilterString = buildCSSFilterString((op as any).filters.cssFilters);
	}

	return (
		<AbsoluteFill style={{ filter: cssFilterString, transform: transformStr }}>
			{content}
		</AbsoluteFill>
	);
};

const LayerContentRenderer: React.FC<{
	layer: ExtendedLayer;
	animVolume: number;
	viewport: { w: number; h: number };
}> = ({ layer, animVolume, viewport }) => {
	const cWidth = layer.width ?? viewport.w;
	const cHeight = layer.height ?? viewport.h;

	if (layer.type === "Video" && layer.virtualMedia)
		return (
			<SingleClipComposition
				virtualMedia={layer.virtualMedia}
				volume={animVolume}
				playbackRateOverride={layer.speed}
				trimStartOverride={layer.trimStart}
				textStyle={layer}
				containerWidth={cWidth}
				containerHeight={cHeight}
			/>
		);
	if (layer.type === "Image" && (layer.src || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);
		return (
			<Img
				src={layer.src!}
				style={{ width: "100%", height: "100%", objectFit: "cover" }}
			/>
		);
	}
	if (layer.type === "Lottie") {
		const loop = layer.lottieLoop ?? true;
		const playbackRate = layer.speed ?? 1;
		if (layer.virtualMedia) {
			const params = computeRenderParams(layer.virtualMedia);
			const lottieSrc = params.sourceUrl;
			if (lottieSrc)
				return (
					<LottieFromUrl
						src={lottieSrc}
						loop={loop}
						playbackRate={playbackRate}
						style={{ width: "100%", height: "100%" }}
					/>
				);
		}
		if (layer.src)
			return (
				<LottieFromUrl
					src={layer.src}
					loop={loop}
					playbackRate={playbackRate}
					style={{ width: "100%", height: "100%" }}
				/>
			);
	}

	if (layer.type === "ThreeD") {
		let srcUrl = layer.src;
		let mimeType: string | undefined | null;

		if (layer.virtualMedia) {
			const params = computeRenderParams(layer.virtualMedia);
			srcUrl = params.sourceUrl;
			const op = layer.virtualMedia.operation;
			mimeType =
				op?.op === "source" ? op.source?.processData?.mimeType : undefined;
		}

		if (srcUrl) {
			return (
				<ThreeDFromUrl
					src={srcUrl}
					mimeType={mimeType}
					width={cWidth} // ← pass layer dimensions
					height={cHeight}
					style={{ width: "100%", height: "100%" }}
				/>
			);
		}
	}

	if (layer.type === "Audio" && (layer.src || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					playbackRateOverride={layer.speed}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);
		return <Audio src={layer.src!} volume={animVolume} />;
	}
	if (layer.type === "Text" && (layer.text || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);
		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					color: layer.fill,
					fontSize: layer.fontSize,
					fontFamily: layer.fontFamily,
					fontStyle: layer.fontStyle,
					fontWeight: layer.fontWeight,
					textDecoration: layer.textDecoration,
					lineHeight: layer.lineHeight ?? 1.2,
					letterSpacing: layer.letterSpacing
						? `${layer.letterSpacing}px`
						: undefined,
					textAlign: (layer.align as "left" | "center" | "right") ?? "left",
					padding: layer.padding,
					WebkitTextStroke:
						layer.strokeWidth && layer.stroke
							? `${layer.strokeWidth}px ${layer.stroke}`
							: undefined,
					paintOrder: "stroke fill",
					display: "flex",
					flexDirection: "column",
					justifyContent:
						layer.verticalAlign === "middle"
							? "center"
							: layer.verticalAlign === "bottom"
								? "flex-end"
								: "flex-start",
					whiteSpace: "pre",
				}}
			>
				{layer.text}
			</div>
		);
	}
	return null;
};

export const LayerRenderer: React.FC<{
	layer: ExtendedLayer;
	viewport: { w: number; h: number };
}> = ({ layer, viewport }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const startFrame = layer.startFrame ?? 0;
	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
	const {
		x: animX,
		y: animY,
		scale: animScale,
		rotation: animRotation,
		opacity: animOpacity,
		volume: animVolume,
	} = calculateLayerTransform(layer, frame, fps, viewport);
	const style: React.CSSProperties = {
		position: "absolute",
		left: animX,
		top: animY,
		width: layer.width,
		height: layer.height,
		transform: `rotate(${animRotation}deg) scale(${animScale})`,
		transformOrigin: "center center",
		opacity: animOpacity,
		backgroundColor: layer.backgroundColor,
		borderColor: layer.borderColor,
		borderWidth: layer.borderWidth,
		borderRadius: layer.borderRadius,
		borderStyle: layer.borderWidth ? "solid" : undefined,
		overflow: "hidden",
		boxSizing: "border-box",
	};
	const filterString = (() => {
		const cf = layer.filters?.cssFilters;
		if (!cf) return undefined;
		return buildCSSFilterString(cf);
	})();

	return (
		<Sequence from={startFrame} durationInFrames={duration} layout="none">
			<div style={{ ...style, filter: filterString }}>
				<AbsoluteFill>
					<LayerContentRenderer
						layer={layer}
						animVolume={animVolume}
						viewport={viewport}
					/>
				</AbsoluteFill>
			</div>
		</Sequence>
	);
};

export interface SceneProps {
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	containerWidth?: number;
	containerHeight?: number;
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | "Lottie" | "ThreeD" | string;
	data?: unknown;
	virtualMedia?: VirtualMediaData;
	children?: React.ReactNode;
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	fontStyle?: string;
	fontWeight?: number | string;
	WebkitTextStroke?: string;
	paintOrder?: string;
	autoDimensions?: boolean;
	textDecoration?: string;
	fill?: string;
	align?: string;
	verticalAlign?: string;
	letterSpacing?: number;
	lineHeight?: number;
	padding?: number;
	stroke?: string;
	strokeWidth?: number;
	backgroundColor?: string;
	borderColor?: string;
	borderWidth?: number;
	borderRadius?: number;
	animations?: VideoAnimation[];
	startFrame?: number;
	durationInFrames?: number;
	opacity?: number;
	volume?: number;
	scale?: number;
	rotation?: number;
	x?: number;
	y?: number;
}

export const CompositionScene: React.FC<SceneProps> = ({
	layers = [],
	viewportWidth,
	viewportHeight,
	containerWidth,
	containerHeight,
	src,
	isAudio,
	type,
	data,
	virtualMedia,
	durationInFrames,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const resolvedLayers = (() => {
		if (layers.length > 0) return layers;
		if (
			src ||
			virtualMedia ||
			type === "Text" ||
			type === "Lottie" ||
			type === "ThreeD"
		) {
			const resolvedType = type || (isAudio ? "Audio" : "Video");
			let resolvedDurationInFrames = durationInFrames;
			if (!resolvedDurationInFrames && virtualMedia) {
				const activeMeta = getActiveMediaMetadata(virtualMedia);
				if (activeMeta?.durationMs)
					resolvedDurationInFrames = Math.ceil(
						(activeMeta.durationMs / 1000) * (fps || 24),
					);
			}
			return [
				{
					id: "single-source-layer",
					type: resolvedType as any,
					src,
					virtualMedia,
					text:
						typeof data === "string"
							? data
							: (data as any)?.text || JSON.stringify(data),
					width: viewportWidth,
					height: viewportHeight,
				} as ExtendedLayer,
			];
		}
		return [];
	})();

	const layersToRender = [...resolvedLayers]
		.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
		.map((layer) => {
			let derivedWidth = layer.width;
			let derivedHeight = layer.height;
			if (layer.virtualMedia && layer.autoDimensions) {
				const activeMeta = getActiveMediaMetadata(layer.virtualMedia);
				derivedWidth = activeMeta?.width ?? derivedWidth;
				derivedHeight = activeMeta?.height ?? derivedHeight;
			}
			return { ...layer, width: derivedWidth, height: derivedHeight };
		});

	const resolvedViewportW = viewportWidth || 1920;
	const resolvedViewportH = viewportHeight || 1080;
	const viewport = { w: resolvedViewportW, h: resolvedViewportH };
	const scaleX =
		containerWidth !== undefined ? containerWidth / resolvedViewportW : 1;
	const scaleY =
		containerHeight !== undefined ? containerHeight / resolvedViewportH : 1;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#000000",
				overflow: "hidden",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					width: resolvedViewportW,
					height: resolvedViewportH,
					position: "absolute",
					top: 0,
					left: 0,
					transform: `scale(${scaleX}, ${scaleY})`,
					transformOrigin: "top left",
				}}
			>
				{layersToRender.map((layer) => {
					const startFrame = layer.startFrame ?? 0;
					const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
					const endFrame = startFrame + duration;
					if (frame < startFrame || frame >= endFrame) return null;
					return (
						<LayerRenderer key={layer.id} layer={layer} viewport={viewport} />
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
