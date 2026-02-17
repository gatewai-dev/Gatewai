import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
	const [virtualCursorPos, setVirtualCursorPos] = useState({ x: 0, y: 0 });

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
		if (Number.isNaN(num)) num = 0;
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
		(e: React.MouseEvent<Element, MouseEvent>) => {
			e.preventDefault();
			if (disabled) return;
			const target = e.currentTarget as HTMLElement;

			// Request pointer lock for infinite dragging
			target.requestPointerLock();

			setIsDragging(true);
			setVirtualCursorPos({ x: e.clientX, y: e.clientY });

			let totalDeltaX = 0;
			const startValue = value;

			// Use refs for mutable values during the drag to avoid closure stale state
			let currentX = e.clientX;
			let currentY = e.clientY;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.movementX;
				const deltaY = moveEvent.movementY;

				totalDeltaX += deltaX;

				// Update virtual cursor position
				currentX += deltaX;
				currentY += deltaY;

				// Wrap horizontally
				if (currentX < 0) currentX = window.innerWidth;
				if (currentX > window.innerWidth) currentX = 0;

				// Clamp vertically
				if (currentY < 0) currentY = 0;
				if (currentY > window.innerHeight) currentY = window.innerHeight;

				setVirtualCursorPos({ x: currentX, y: currentY });

				const multiplier = moveEvent.shiftKey ? 10 : 1;
				// Slower sensitivity for better control
				const change = Math.round(totalDeltaX * 0.5) * multiplier * step;
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
				document.removeEventListener("pointerlockchange", handleLockChange);
				if (document.pointerLockElement) {
					document.exitPointerLock();
				}
				// document.body.style.cursor = ""; // No need to set body cursor, we handle it with virtual cursor
			};

			const handleLockChange = () => {
				if (!document.pointerLockElement) {
					handleMouseUp();
				}
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.addEventListener("pointerlockchange", handleLockChange);
			// document.body.style.cursor = "ew-resize"; // We render our own
		},
		[value, onChange, step, min, max, allowDecimal, disabled],
	);

	return (
		<div className={cn("flex flex-col space-y-1", className)}>
			{isDragging &&
				createPortal(
					<div
						style={{
							position: "fixed",
							left: 0,
							top: 0,
							transform: `translate(${virtualCursorPos.x}px, ${virtualCursorPos.y}px)`,
							pointerEvents: "none",
							zIndex: 9999,
							marginTop: -12,
							marginLeft: -12,
						}}
					>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M7.99998 12L10.9999 15M7.99998 12L10.9999 9M7.99998 12H16M16 12L13 15M16 12L13 9"
								stroke="black"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<circle
								cx="12"
								cy="12"
								r="8"
								stroke="black"
								strokeWidth="2"
								fill="white"
								fillOpacity="0.5"
							/>
						</svg>
					</div>,
					document.body,
				)}
			{label && <Label>{label}</Label>}
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
