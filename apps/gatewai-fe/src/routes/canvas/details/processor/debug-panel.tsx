import { useEffect, useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useProcessor } from "./processor-ctx";

function DebugPanel() {
  const processor = useProcessor();
  const [logs, setLogs] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onProcessed = ({ nodeId }: any) => {
      setLogs(prev => [...prev, `✅ ${nodeId} processed`]);
    };

    const onError = ({ nodeId, error }: any) => {
      setLogs(prev => [...prev, `❌ ${nodeId} error: ${error}`]);
    };

    processor.on("node:processed", onProcessed);
    processor.on("node:error", onError);

    return () => {
      processor.off("node:processed", onProcessed);
      processor.off("node:error", onError);
    };
  }, [processor]);

  return (
    <div className="">
      <Collapsible open={open} onOpenChange={setOpen} className="w-80">
        <Card className="shadow-xl">
          <CardHeader className="flex flex-row justify-between items-center py-3 px-4">
            <CardTitle className="text-sm">Processing Log</CardTitle>

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="max-h-64 overflow-auto space-y-1 text-xs">
              {logs.reverse().map((log, i) => (
                <div key={i} className="border-b border-muted pb-1">
                  {log}
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export {DebugPanel};
