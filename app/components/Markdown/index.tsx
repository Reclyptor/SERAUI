"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark-dimmed.css";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={
        className ??
        "prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:mt-6 prose-headings:mb-3 prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-pre:my-4 prose-blockquote:my-4 prose-table:my-4 prose-hr:my-6 prose-pre:bg-[#2d2a27] prose-pre:border prose-pre:border-[#3d3a37] prose-code:text-[#a4c639] prose-th:pb-2 prose-td:py-2 prose-a:text-[#a4c639] prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-[#a4c639]"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
