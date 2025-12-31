import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = memo(({ markdown }: { markdown: string }) => {
	return <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>;
});

export { MarkdownRenderer };
