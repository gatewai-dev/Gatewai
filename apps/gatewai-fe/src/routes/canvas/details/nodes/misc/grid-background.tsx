import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const GridBackground = ({children, className}: {children?: ReactNode, className?: string}) => {
    return (<div className={cn("w-full media-container h-[280px]", className)}>
        {children}
    </div>);
}

export { GridBackground }
