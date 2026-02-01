import type { AutosizeTextAreaRef } from "@/components/ui/autosize-textarea";
import { InputArea } from "./input-area";

interface EmptyStateProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	isLoading: boolean;
	handleSubmit: () => Promise<void>;
	stopGeneration: () => void;
	textareaRef: React.RefObject<AutosizeTextAreaRef | null>;
	selectedModel: string;
	setSelectedModel: (value: string) => void;
}

export function EmptyState({
	inputValue,
	setInputValue,
	isLoading,
	handleSubmit,
	stopGeneration,
	textareaRef,
	selectedModel,
	setSelectedModel,
}: EmptyStateProps) {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-2">
			<div className="w-full max-w-3xl space-y-8">
				<div className="space-y-2 px-2">
					<h1 className="text-2xl font-semibold text-foreground/90">
						Gatewai Copilot
					</h1>
					<p className="text-sm text-muted-foreground">
						Your AI assistant for building workflows.
					</p>
				</div>
				<InputArea
					centered
					inputValue={inputValue}
					setInputValue={setInputValue}
					isLoading={isLoading}
					handleSubmit={handleSubmit}
					stopGeneration={stopGeneration}
					textareaRef={textareaRef}
					selectedModel={selectedModel}
					setSelectedModel={setSelectedModel}
				/>
			</div>
		</div>
	);
}
