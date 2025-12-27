import type { CanvasDetailsNode } from "@/rpc/types"
import type { NodeProps, Node } from "@xyflow/react"
import { MenuIcon } from "lucide-react"
import { memo, useState } from "react"
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
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAppDispatch, useAppSelector } from "@/store"
import { makeSelectNodeById, updateNodeEntity } from "@/store/nodes"

type RenameNodeDialogProps = {
  nodeId: string
  currentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const renameSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

const RenameNodeDialog = memo(({
  nodeId,
  currentName,
  open,
  onOpenChange,
}: RenameNodeDialogProps) => {
  const dispatch = useAppDispatch();

  const form = useForm<z.infer<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: currentName },
  })

  const onSubmit = (data: z.infer<typeof renameSchema>) => {
    dispatch(updateNodeEntity({
        id: nodeId,
        changes: { name: data.name }
    }));
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Node</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
})

const NodeMenu = memo((props: NodeProps<Node<CanvasDetailsNode>>) => {
    const { onNodesDelete, duplicateNodes } = useCanvasCtx();
    const [renameOpen, setRenameOpen] = useState(false);
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
    const node = useAppSelector(makeSelectNodeById(props.id));
    const currentName = node.name || "";

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="xs" variant="ghost"><MenuIcon /> </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                    Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateNodes([props.id])}>
                    Duplicate
                    <DropdownMenuShortcut className="italic text-[11px]">{isMac ? '⌘ D' : 'ctrl + d'}</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNodesDelete([props.id])}>
                    Delete
                    <DropdownMenuShortcut className="italic text-[11px]">delete / backspace</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
        <RenameNodeDialog
          nodeId={props.id}
          currentName={currentName}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
        </>
    )
});

export { NodeMenu };