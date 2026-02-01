"use client";

import * as React from "react";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "./textarea";

interface UseAutosizeTextAreaProps {
	textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
	minHeight?: number;
	maxHeight?: number;
	value: string | number | readonly string[] | undefined;
}

export const useAutosizeTextArea = ({
	textAreaRef,
	value,
	maxHeight = Number.MAX_SAFE_INTEGER,
	minHeight = 0,
}: UseAutosizeTextAreaProps) => {
	useLayoutEffect(() => {
		const textAreaElement = textAreaRef.current;
		if (textAreaElement) {
			// We need to reset the height momentarily to get the correct scrollHeight for the textarea
			textAreaElement.style.height = "auto";

			const scrollHeight = textAreaElement.scrollHeight;

			// Adjust height based on scrollHeight and constraints
			if (scrollHeight > maxHeight) {
				textAreaElement.style.height = `${maxHeight}px`;
				textAreaElement.style.overflowY = "auto";
			} else if (scrollHeight < minHeight) {
				textAreaElement.style.height = `${minHeight}px`;
				textAreaElement.style.overflowY = "hidden";
			} else {
				textAreaElement.style.height = `${scrollHeight}px`;
				textAreaElement.style.overflowY = "hidden";
			}
		}
	}, [textAreaRef, value, maxHeight, minHeight]);
};

export type AutosizeTextAreaRef = {
	textArea: HTMLTextAreaElement;
	focus: () => void;
	maxHeight: number;
	minHeight: number;
};

type AutosizeTextAreaProps = {
	maxHeight?: number;
	minHeight?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AutosizeTextarea = React.forwardRef<
	AutosizeTextAreaRef,
	AutosizeTextAreaProps
>(
	(
		{
			maxHeight = Number.MAX_SAFE_INTEGER,
			minHeight = 52,
			className,
			onChange,
			value,
			defaultValue,
			...props
		}: AutosizeTextAreaProps,
		ref: React.Ref<AutosizeTextAreaRef>,
	) => {
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

		useAutosizeTextArea({
			textAreaRef,
			value: value || defaultValue || "",
			maxHeight,
			minHeight,
		});

		useImperativeHandle(ref, () => ({
			textArea: textAreaRef.current as HTMLTextAreaElement,
			focus: () => textAreaRef.current?.focus(),
			maxHeight,
			minHeight,
		}));

		const handleInternalChange = (
			e: React.ChangeEvent<HTMLTextAreaElement>,
		) => {
			onChange?.(e);
		};

		return (
			<Textarea
				{...props}
				value={value}
				defaultValue={defaultValue}
				ref={textAreaRef}
				className={cn(
					"flex w-full px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
					className,
				)}
				onChange={handleInternalChange}
			/>
		);
	},
);
AutosizeTextarea.displayName = "AutosizeTextarea";
