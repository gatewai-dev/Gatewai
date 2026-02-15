import { discoveredNodes } from "virtual:gatewai-nodes";
import {
	CanvasModeProvider,
	CanvasProvider,
	NodeTemplateDnDProvider,
	NodeTemplatesProvider,
	ProcessorProvider,
	ReactFlowProvider,
	TaskManagerProvider,
	UserAssetsProvider,
} from "@gatewai/react-canvas";
import { Outlet, useParams } from "react-router";
import { CanvasAgentSessionsProvider } from "./agent/ctx/canvas-sessions.ctx";
import { ShortcutsProvider } from "./ctx/hotkeys-ctx";

function CanvasDetailsRoot() {
	const { canvasId } = useParams();
	if (!canvasId) {
		return <>Missing canvas identifier</>;
	}
	return (
		<>
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
													<Outlet />
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
		</>
	);
}

export { CanvasDetailsRoot };
