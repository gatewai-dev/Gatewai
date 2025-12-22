import { NodeTemplatesProvider } from "@/node-templates/node-templates.ctx";
import { CanvasProvider } from "./ctx/canvas-ctx";
import { ReactflowContainer } from "./reactflow-container";
import { NodeTemplateDnDProvider } from "@/node-templates/node-template-drag.ctx";

function CanvasDetails() {
    return (
    <NodeTemplateDnDProvider>
        <NodeTemplatesProvider>
                <CanvasProvider canvasId={"2"}>
                    <ReactflowContainer />
                </CanvasProvider>
        </NodeTemplatesProvider>
    </NodeTemplateDnDProvider>);
}

export { CanvasDetails };
