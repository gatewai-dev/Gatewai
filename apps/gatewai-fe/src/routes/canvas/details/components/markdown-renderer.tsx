import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const MarkdownRenderer = memo(({ markdown, className }: { markdown: string, className?: string }) => {
	return (
		<div className={cn("prose prose-xs dark:prose-invert max-w-none break-words [&_pre]:whitespace-pre-wrap [&_code]:break-all [&_p]:break-words", className)}>
			<Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
		</div>
	);
});

export { MarkdownRenderer };
