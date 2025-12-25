import { useUpdateNameMutation } from "@/store/canvas";
import { memo, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

const CanvasName = memo(() => {
  const [updateCanvasNameMutation, { isLoading }] = useUpdateNameMutation();
  const { canvas } = useCanvasCtx();
  const currentName = canvas?.name;

  const [localName, setLocalName] = useState(currentName);

  useEffect(() => {
    setLocalName(currentName);
  }, [currentName]);

  const handleBlur = () => {
    if (!localName || !canvas) return;

    const trimmed = localName.trim();
    if (trimmed === "") {
      setLocalName(currentName);
    } else if (trimmed !== currentName) {
      updateCanvasNameMutation({
        json: { name: trimmed },
        param: {id: canvas.id }
      });
    }
  };

  return (
    <div className="relative">
      <Input
        className="border-none focus:border focus:border-input"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleBlur}
        disabled={isLoading}
      />
      {isLoading && (
        <div className="absolute inset-0 border border-input rounded-md animate-pulse" />
      )}
    </div>
  );
});

export { CanvasName };