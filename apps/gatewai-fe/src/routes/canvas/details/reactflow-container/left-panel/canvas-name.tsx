import { memo, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useUpdateNameMutation } from "@gatewai/react-store";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

const CanvasName = memo(() => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [localName, setLocalName] = useState("");
	const { canvas } = useCanvasCtx();
	const currentName = canvas?.name ?? ""; // Fallback to empty string if undefined
	const [updateCanvasName, { isLoading }] = useUpdateNameMutation();

	useEffect(() => {
		setLocalName(currentName);
	}, [currentName]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const enterEditMode = () => {
		if (!isLoading) {
			setIsEditing(true);
		}
	};

	const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			enterEditMode();
		}
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.currentTarget.blur();
		} else if (e.key === "Escape") {
			setLocalName(currentName);
			setIsEditing(false);
		}
	};

	const handleBlur = () => {
		const trimmed = localName.trim();
		if (trimmed === "") {
			setLocalName(currentName);
			setIsEditing(false);
			return;
		}

		if (trimmed === currentName) {
			setIsEditing(false);
			return;
		}

		if (!canvas) {
			setIsEditing(false);
			return;
		}

		updateCanvasName({
			json: { name: trimmed },
			param: { id: canvas.id },
		})
			.unwrap()
			.then(() => {
				setIsEditing(false);
			})
			.catch(() => {
				setLocalName(currentName);
				setIsEditing(false);
			});
	};

	const sharedStyles = "font-semibold tracking-tight text-sm";

	if (!isEditing) {
		return (
			// biome-ignore lint/a11y/useSemanticElements: No need
			<div
				className={`${sharedStyles} cursor-pointer select-none`}
				onClick={enterEditMode}
				onKeyDown={handleDisplayKeyDown}
				role="button"
				tabIndex={0}
				aria-label={`Edit canvas name: ${currentName}`}
				aria-disabled={isLoading}
			>
				{currentName}
			</div>
		);
	}

	return (
		<div className="relative">
			<Input
				ref={inputRef}
				className={`border-none focus:border focus:border-input ${sharedStyles}`}
				value={localName}
				onChange={(e) => setLocalName(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleInputKeyDown}
				disabled={isLoading}
				autoFocus
				aria-label="Canvas name input"
			/>
			{isLoading && (
				<div className="absolute inset-0 border border-input rounded-md animate-pulse" />
			)}
		</div>
	);
});

export { CanvasName };
