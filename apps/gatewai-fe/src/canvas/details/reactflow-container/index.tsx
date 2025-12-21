import { Background, ReactFlow } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";


function ReactflowContainer(
    {children}:
    {children?: React.ReactNode}) {

    const {clientNodes, clientEdges} = useCanvasCtx();

    return (
        <div className="w-full h-screen">
            <ReactFlow
                edges={clientEdges}
                nodes={clientNodes} fitView nodeTypes={nodeTypes}>
                {children}
                <Background />
            </ReactFlow>
        </div>
    );
}

export { ReactflowContainer };