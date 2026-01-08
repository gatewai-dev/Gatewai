import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = memo(({ markdown }: { markdown: string }) => {
	return (
		<div className="prose-sm prose-hr:my-3 word whitespace-pre">
			<Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
		</div>
	);
});

export { MarkdownRenderer };
