import { cn } from "@/lib/utils";
import { Application } from "@pixi/react";
import { useRef, type ReactNode } from "react";

function PixiApplication({children, className}: {children: ReactNode, className?: string}) {
    const parentRef = useRef(null);
    return (
        <div ref={parentRef} className={cn(className, "media-container")}>
            <Application resizeTo={parentRef}>
                {children}
            </Application>
        </div>
    )
}

export { PixiApplication };
