
import { CanvasProvider } from "./ctx/canvas-ctx";
import { ReactflowContainer } from "./reactflow-container";
import { useParams } from "react-router";
import { SelectedEntitiesProvider } from "./ctx/selected-entity-ctx";
import { ReactFlowProvider } from "@xyflow/react";
import { UserAssetsProvider } from "../assets/user-assets-ctx";
import { NodeTemplateDnDProvider } from "../node-templates/node-template-drag.ctx";
import { NodeTemplatesProvider } from "../node-templates/node-templates.ctx";
import { TaskManagerProvider } from "./ctx/task-manager-ctx";
import { PhotonProvider } from "./ctx/photon-loader";

function CanvasDetails() {
    const { canvasId } = useParams();
    if (!canvasId) {
        return <>Missing canvas identifier</>
    }
    return (
        <NodeTemplateDnDProvider>
            <PhotonProvider>
            <TaskManagerProvider canvasId={canvasId}>
                <NodeTemplatesProvider>
                    <UserAssetsProvider>
                        <SelectedEntitiesProvider>
                            <ReactFlowProvider>
                                <CanvasProvider canvasId={canvasId}>
                                    <ReactflowContainer />
                                </CanvasProvider>
                            </ReactFlowProvider>
                        </SelectedEntitiesProvider>
                    </UserAssetsProvider>
                </NodeTemplatesProvider>
            </TaskManagerProvider>
            </PhotonProvider>
        </NodeTemplateDnDProvider>);
}

export { CanvasDetails };
