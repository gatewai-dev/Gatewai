import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

interface DraggableNumberInputProps {
	value: number;
	onChange: (value: number) => void;
	label?: string;
	icon?: React.ElementType;
	allowDecimal?: boolean;
	min?: number;
	max?: number;
	step?: number;
	className?: string;
	disabled?: boolean;
}

const DraggableNumberInput: React.FC<DraggableNumberInputProps> = ({
	value,
	onChange,
	label,
	className,
	disabled,
	icon: Icon,
	allowDecimal = false,
	min,
	max,
	step = 1,
}) => {
	const [isDragging, setIsDragging] = useState(false);
	const [text, setText] = useState(value.toString());

	// Update text if external value changes (and not currently typing/dragging)
	useEffect(() => {
		if (
			!isDragging &&
			document.activeElement !== document.getElementById(`input-${label}`)
		) {
			setText(allowDecimal ? value.toString() : Math.round(value).toString());
		}
	}, [value, allowDecimal, isDragging, label]);

	const commit = (strVal: string) => {
		let num = allowDecimal ? parseFloat(strVal) : parseInt(strVal, 10);
		if (isNaN(num)) num = 0;
		if (min !== undefined) num = Math.max(min, num);
		if (max !== undefined) num = Math.min(max, num);
		if (!allowDecimal) num = Math.round(num);
		onChange(num);
		setText(allowDecimal ? num.toString() : Math.round(num).toString());
	};

	const handleBlur = () => commit(text);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.currentTarget.blur();
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			commit((parseFloat(text) + step).toString());
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			commit((parseFloat(text) - step).toString());
		}
	};

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			if (disabled) return;
			setIsDragging(true);
			const startX = e.clientX;
			const startValue = value;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.clientX - startX;
				const multiplier = moveEvent.shiftKey ? 10 : 1;
				// Slower sensitivity for better control
				const change = Math.round(deltaX * 0.5) * multiplier * step;
				let newValue = startValue + change;

				if (min !== undefined) newValue = Math.max(min, newValue);
				if (max !== undefined) newValue = Math.min(max, newValue);
				if (!allowDecimal) newValue = Math.round(newValue);

				onChange(newValue);
				setText(newValue.toString());
			};

			const handleMouseUp = () => {
				setIsDragging(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				document.body.style.cursor = "";
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "ew-resize";
		},
		[value, onChange, step, min, max, allowDecimal, disabled],
	);

	return (
		<div className={cn("flex flex-col space-y-1", className)}>
			{label && (
				<Label className="text-[10px] text-muted-foreground uppercase font-semibold">
					{label}
				</Label>
			)}
			<div className="group relative flex items-center bg-muted/40 rounded-md border border-input focus-within:ring-1 focus-within:ring-ring focus-within:border-transparent overflow-hidden h-8">
				{Icon && (
					<div
						className={cn(
							"flex items-center justify-center w-8 h-full hover:bg-accent/50 active:bg-accent transition-colors border-r border-border/50 text-muted-foreground hover:text-foreground",
							{ "cursor-ew-resize": !disabled },
						)}
						onMouseDown={handleMouseDown}
						title="Drag to adjust"
					>
						<Icon className="w-3.5 h-3.5" />
					</div>
				)}
				<Input
					id={`input-${label}`}
					type="text"
					disabled={disabled}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					className="h-full border-0 rounded-none bg-transparent px-2 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
				/>
			</div>
		</div>
	);
};

export { DraggableNumberInput };
