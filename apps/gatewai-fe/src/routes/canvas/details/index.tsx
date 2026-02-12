import { ReactFlowProvider } from "@xyflow/react";
import { Outlet, useParams } from "react-router";
import { UserAssetsProvider } from "../assets/user-assets-ctx";
import { CanvasAgentSessionsProvider } from "./agent/ctx/canvas-sessions.ctx";
import { CanvasProvider } from "../../../../../../packages/react-canvas/src/canvas-ctx";
import { CanvasModeProvider } from "../../../../../../packages/react-canvas/src/canvas-mode-ctx";
import { ShortcutsProvider } from "./ctx/hotkeys-ctx";
import { TaskManagerProvider } from "./ctx/task-manager-ctx";
import { ProcessorProvider } from "./graph-engine/processor-ctx";
import { NodeTemplateDnDProvider } from "./node-templates/node-template-drag.ctx";
import { NodeTemplatesProvider } from "./node-templates/node-templates.ctx";

function CanvasDetailsRoot() {
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
											<ProcessorProvider>
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
	);
}

export { CanvasDetailsRoot };
