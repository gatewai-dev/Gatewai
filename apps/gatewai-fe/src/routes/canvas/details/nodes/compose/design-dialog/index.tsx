import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { NodeEntityType } from "@/store/nodes";
import { memo, useState } from "react"
import { CanvasDesignerEditor } from "../canvas-editor";
import { ImagesIcon } from "lucide-react";

const DesignDialog = memo(({node}: {node: NodeEntityType}) => {

    return (
        <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><ImagesIcon /> Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-screen! h-screen w-screen! max-h-screen!">
              <CanvasDesignerEditor onSave={console.log} initialLayers={[]} />
            </DialogContent>
        </Dialog>)
});

export { DesignDialog }
