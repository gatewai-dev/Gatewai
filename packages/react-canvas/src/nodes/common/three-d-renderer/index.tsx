import type { VirtualMediaData } from "@gatewai/core/types";
import {
	createVirtualMedia,
	resolveMediaSourceUrl,
} from "@gatewai/remotion-compositions";
import { Button } from "@gatewai/ui-kit";
import {
	GizmoHelper,
	GizmoViewport,
	OrbitControls,
	Stage,
	useGLTF,
} from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

class ErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ hasError: boolean; error: Error | null }
> {
	constructor(props: { children: React.ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("ThreeD Loader Error:", error, errorInfo);
	}

	override render() {
		if (this.state.hasError) {
			return (
				<div className="flex w-full h-full items-center justify-center text-red-500 bg-red-950 p-4 rounded text-sm overflow-hidden text-center break-all">
					Error loading 3D model: {this.state.error?.message}
				</div>
			);
		}
		return this.props.children;
	}
}

function OBJModel({ url }: { url: string }) {
	const obj = useLoader(OBJLoader, url);
	useEffect(() => {
		console.log("OBJ Loaded", { url, obj });
	}, [url, obj]);
	return <primitive object={obj} />;
}

function STLModel({ url }: { url: string }) {
	const stl = useLoader(STLLoader, url);

	useEffect(() => {
		stl.center();
		stl.computeVertexNormals();
	}, [stl]);

	return (
		<mesh geometry={stl}>
			<meshNormalMaterial />
		</mesh>
	);
}

function GLTFModel({ url }: { url: string }) {
	const gltf = useGLTF(url);
	useEffect(() => {
		console.log("GLTF Loaded", { url, gltf });
	}, [url, gltf]);
	return <primitive object={gltf.scene} />;
}

function Model({ url, mimeType }: { url: string; mimeType?: string }) {
	const extension = useMemo(() => {
		if (mimeType === "model/stl") return "stl";
		if (mimeType === "model/obj") return "obj";
		if (mimeType?.includes("gltf") || mimeType?.includes("glb")) return "gltf";

		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;
			return path.split(".").pop()?.toLowerCase();
		} catch (e) {
			return url.split(".").pop()?.toLowerCase();
		}
	}, [url, mimeType]);

	if (extension === "obj") return <OBJModel url={url} />;
	if (extension === "stl") return <STLModel url={url} />;
	return <GLTFModel url={url} />;
}

export function ThreeDRenderer({
	virtualMedia,
}: {
	virtualMedia: VirtualMediaData;
}) {
	const controlsRef = useRef<any>(null);

	const handleZoom = (delta: number) => {
		if (!controlsRef.current) return;
		const controls = controlsRef.current;
		const camera = controls.object;

		if (camera.type === "OrthographicCamera") {
			camera.zoom *= delta > 0 ? 1.2 : 0.8;
			camera.updateProjectionMatrix();
		} else {
			const distance = camera.position.distanceTo(controls.target);
			if (delta > 0) {
				camera.position.lerp(controls.target, 0.2);
			} else {
				const direction = new THREE.Vector3()
					.subVectors(camera.position, controls.target)
					.normalize();
				camera.position.add(direction.multiplyScalar(distance * 0.25));
			}
			controls.update();
		}
	};

	const handleReset = () => {
		if (controlsRef.current) {
			controlsRef.current.reset();
		}
	};

	const normalizedMedia = useMemo(
		() => createVirtualMedia(virtualMedia, "ThreeD"),
		[virtualMedia],
	);
	const url = useMemo(
		() => resolveMediaSourceUrl(normalizedMedia),
		[normalizedMedia],
	);
	const mimeType = useMemo(() => {
		const op = normalizedMedia.operation;
		return op?.op === "source" ? op.source?.processData?.mimeType : undefined;
	}, [normalizedMedia]);

	if (!url) return null;

	return (
		<ErrorBoundary>
			<div
				className="relative w-full overflow-hidden media-container"
				style={{ aspectRatio: "1 / 1" }}
			>
				{/* Controls overlay anchored to the aspect-ratio container */}
				<div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 p-1.5 bg-background/50 border backdrop-blur shadow-sm rounded-lg">
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-foreground"
						onClick={() => handleZoom(1)}
						title="Zoom In"
					>
						<ZoomIn className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-foreground"
						onClick={() => handleZoom(-1)}
						title="Zoom Out"
					>
						<ZoomOut className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-foreground"
						onClick={handleReset}
						title="Reset View"
					>
						<RefreshCw className="size-4" />
					</Button>
				</div>

				<Canvas
					camera={{ position: [5, 5, 5], fov: 50, near: 0.1, far: 10000 }}
					className="fixed inset-0 block w-full h-full"
				>
					<ambientLight intensity={Math.PI / 2} />
					<Suspense fallback={null}>
						<Stage
							intensity={0.5}
							environment="studio"
							adjustCamera={1}
							center={{}}
						>
							<Model key={url} url={url} mimeType={mimeType as string} />
						</Stage>
					</Suspense>
					<OrbitControls ref={controlsRef} makeDefault />
				</Canvas>
			</div>
		</ErrorBoundary>
	);
}
