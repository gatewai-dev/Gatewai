import type { CanvasDetailsNode } from "@/rpc/types"
import type { NodeProps, Node } from "@xyflow/react"
import { MenuIcon } from "lucide-react"
import { memo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuShortcut,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCanvasCtx } from "../ctx/canvas-ctx"

const NodeMenu = memo((props: NodeProps<Node<CanvasDetailsNode>>) => {
    const { onNodesDelete, rfInstance } = useCanvasCtx();

    const deleteNode = () => {
        const node = rfInstance.current?.getNode(props.id);
        if (node) {
            onNodesDelete([node]);
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="xs" variant="ghost"><MenuIcon /> </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuGroup>
                <DropdownMenuItem onClick={deleteNode}>
                    Delete
                    <DropdownMenuShortcut className="italic">Delete</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>)
});

export { NodeMenu };

