import { Button } from "@/components/ui/button";

function AddCustomHandleButton(props: { type: "INPUT" | "OUTPUT" }) {
    return (
        <Button size="sm" variant="outline">
            Add {props.type.toLowerCase()} Handle
        </Button>
    );
}