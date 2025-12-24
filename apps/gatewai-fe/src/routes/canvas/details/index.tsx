
import { CanvasProvider } from "./ctx/canvas-ctx";
import { ReactflowContainer } from "./reactflow-container";
import { useParams } from "react-router";
import { SelectedEntitiesProvider } from "./ctx/selected-entity-ctx";
import { ReactFlowProvider } from "@xyflow/react";
import { UserAssetsProvider } from "../assets/library.ctx";
import { NodeTemplateDnDProvider } from "../node-templates/node-template-drag.ctx";
import { NodeTemplatesProvider } from "../node-templates/node-templates.ctx";

function CanvasDetails() {
    const { canvasId } = useParams();
    if (!canvasId) {
        return <>Missing canvas identifier</>
    }
    return (
        <NodeTemplateDnDProvider>
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
        </NodeTemplateDnDProvider>);
}

export { CanvasDetails };
