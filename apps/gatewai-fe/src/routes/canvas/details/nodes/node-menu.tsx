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
    const { onNodesDelete, duplicateNode, rfInstance } = useCanvasCtx();

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
            <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => duplicateNode(props.id)}>
                    Duplicate
                    <DropdownMenuShortcut className="italic text-[11px]">ctrl + d</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deleteNode}>
                    Delete
                    <DropdownMenuShortcut className="italic text-[11px]">delete / backspace</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>)
});

export { NodeMenu };

