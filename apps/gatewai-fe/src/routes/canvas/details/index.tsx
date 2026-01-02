import { ReactFlowProvider } from "@xyflow/react";
import { Outlet, useParams } from "react-router";
import { UserAssetsProvider } from "../assets/user-assets-ctx";
import { NodeTemplateDnDProvider } from "../node-templates/node-template-drag.ctx";
import { NodeTemplatesProvider } from "../node-templates/node-templates.ctx";
import { CanvasProvider } from "./ctx/canvas-ctx";
import { SelectedEntitiesProvider } from "./ctx/selected-entity-ctx";
import { TaskManagerProvider } from "./ctx/task-manager-ctx";
import { ProcessorProvider } from "./processor/processor-ctx";

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
						<SelectedEntitiesProvider>
							<ReactFlowProvider>
								<CanvasProvider canvasId={canvasId}>
									<ProcessorProvider>
										<Outlet />
									</ProcessorProvider>
								</CanvasProvider>
							</ReactFlowProvider>
						</SelectedEntitiesProvider>
					</UserAssetsProvider>
				</NodeTemplatesProvider>
			</TaskManagerProvider>
		</NodeTemplateDnDProvider>
	);
}

export { CanvasDetailsRoot };
