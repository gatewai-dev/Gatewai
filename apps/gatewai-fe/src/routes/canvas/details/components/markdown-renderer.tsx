import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = memo(({markdown}: {markdown: string}) => {
  return (<div className='text-xs bg-input p-2 max-h-[350px] min-h-[200px] overflow-auto w-full'>
            <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </div>);
})

export { MarkdownRenderer };