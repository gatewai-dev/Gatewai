import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = memo(({ markdown }: { markdown: string }) => {
	return (
		<div className="prose-xs prose-hr:my-3 whitespace-pre-wrap text-xs">
			<Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
		</div>
	);
});

export { MarkdownRenderer };
