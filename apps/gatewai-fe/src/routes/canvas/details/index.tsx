import { discoveredNodes } from "virtual:gatewai-nodes";
import type { NodeRegistryValue } from "@gatewai/react-canvas";
import {
	CanvasModeProvider,
	CanvasProvider,
	NodeRegistryProvider,
	NodeTemplateDnDProvider,
	NodeTemplatesProvider,
	ProcessorProvider,
	ReactFlowProvider,
	TaskManagerProvider,
	UserAssetsProvider,
} from "@gatewai/react-canvas";
import { LoadingSpinner } from "@gatewai/ui-kit";
import { Suspense, use } from "react";
import { Outlet, useParams } from "react-router";
import { CanvasAgentSessionsProvider } from "./agent/ctx/canvas-sessions.ctx";
import { ShortcutsProvider } from "./ctx/hotkeys-ctx";
import { initNodeRegistry } from "./nodes";

// Top-level promise — resolved once, cached by React's `use()`
const registryPromise = initNodeRegistry();

function CanvasContent({ registry }: { registry: NodeRegistryValue }) {
	const { canvasId } = useParams();
	if (!canvasId) {
		return <>Missing canvas identifier</>;
	}
	return (
		<NodeTemplateDnDProvider>
			<TaskManagerProvider canvasId={canvasId}>
				<NodeTemplatesProvider>
					<UserAssetsProvider>
						<ReactFlowProvider>
							<CanvasProvider canvasId={canvasId}>
								<CanvasAgentSessionsProvider canvasId={canvasId}>
									<ShortcutsProvider>
										<CanvasModeProvider>
											<ProcessorProvider registry={discoveredNodes}>
												<NodeRegistryProvider value={registry}>
													<Outlet />
												</NodeRegistryProvider>
											</ProcessorProvider>
										</CanvasModeProvider>
									</ShortcutsProvider>
								</CanvasAgentSessionsProvider>
							</CanvasProvider>
						</ReactFlowProvider>
					</UserAssetsProvider>
				</NodeTemplatesProvider>
			</TaskManagerProvider>
		</NodeTemplateDnDProvider>
	);
}

function CanvasDetailsInner() {
	const registry = use(registryPromise);
	return <CanvasContent registry={registry} />;
}

function CanvasDetailsRoot() {
	return (
		<Suspense
			fallback={
				<div className="w-full h-screen bg-black flex items-center justify-center">
					<LoadingSpinner size={60} />
				</div>
			}
		>
			<CanvasDetailsInner />
		</Suspense>
	);
}

export { CanvasDetailsRoot };
