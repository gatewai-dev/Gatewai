import { NodeTemplatesProvider } from "@/node-templates/node-templates.ctx";
import { CanvasProvider } from "./ctx/canvas-ctx";
import { ReactflowContainer } from "./reactflow-container";
import { NodeTemplateDnDProvider } from "@/node-templates/node-template-drag.ctx";
import { useParams } from "react-router";

function CanvasDetails() {
    const { canvasId } = useParams();
    if (!canvasId) {
        return <>Missing canvas identifier</>
    }
    return (
    <NodeTemplateDnDProvider>
        <NodeTemplatesProvider>
                <CanvasProvider canvasId={canvasId}>
                    <ReactflowContainer />
                </CanvasProvider>
        </NodeTemplatesProvider>
    </NodeTemplateDnDProvider>);
}

export { CanvasDetails };
