import { CanvasProvider } from "./ctx/canvas-ctx";
import { ReactflowContainer } from "./reactflow-container";

function CanvasDetails() {
    return (
    <CanvasProvider canvasId={"2"}>
        <ReactflowContainer />
    </CanvasProvider>);
}

export { CanvasDetails };
