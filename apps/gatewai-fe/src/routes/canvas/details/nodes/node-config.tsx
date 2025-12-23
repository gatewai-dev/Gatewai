import { useAppDispatch } from "@/store";
import type { NodeEntityType } from "@/store/nodes";
import type { Node } from "@gatewai/db";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

function NodeConfig({node}: {node: NodeEntityType}) {
    const dispatch = useAppDispatch();
    const {} = useForm({
        resolver: zodResolver(),
        values: node.config ?? undefined,
    })
    return (<div className="flex gap-1">
        <h3>{node.name}</h3>
    </div>)
}

export { NodeConfig };
