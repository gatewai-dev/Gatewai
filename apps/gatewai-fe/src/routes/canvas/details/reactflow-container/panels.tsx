
import { memo } from "react";
import { NodePalette } from "../../node-templates/node-palette";
import { RightPanel } from "./right-panel";
import { Toolbar } from "./toolbar";
import { TopPanel } from "./top-panel";
import { Panel } from "@xyflow/react";

const ReactFlowPanels = memo(() => {
    return (<>
        <Panel position="top-center" className="bg-background flex flex-col">
            <TopPanel />
        </Panel>
        <Panel
            position="top-left"
            className=" bg-background left-0 top-0 m-0! h-full flex flex-col"
        >
            <NodePalette />
        </Panel>
        <Panel position="bottom-center">
            <Toolbar />
        </Panel>
        <Panel
            position="bottom-right"
            className="bg-background right-0 top-0 m-0! h-full flex flex-col"
        >
            <RightPanel />
        </Panel>
    </>)
})

export { ReactFlowPanels }