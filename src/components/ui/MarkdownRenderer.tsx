'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-cdata-black mb-3 mt-4 first:mt-0 pb-1 border-b border-gray-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-cdata-black mb-2 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-cdata-black mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">
              {children}
            </p>
          ),
          // Strong / Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-cdata-black">{children}</strong>
          ),
          // Emphasis / Italic
          em: ({ children }) => (
            <em className="italic text-gray-600">{children}</em>
          ),
          // Unordered lists
          ul: ({ children }) => (
            <ul className="space-y-1 mb-3 ml-1">
              {children}
            </ul>
          ),
          // Ordered lists
          ol: ({ children }) => (
            <ol className="space-y-1 mb-3 ml-1 list-decimal list-inside">
              {children}
            </ol>
          ),
          // List items with styled bullets
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="w-1.5 h-1.5 bg-cdata-yellow rounded-full mt-2 flex-shrink-0" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          // Inline code
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes('language-');
            if (isBlock) {
              return (
                <code className="block bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-x-auto mb-3">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-gray-100 text-cdata-black px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          // Code blocks
          pre: ({ children }) => (
            <pre className="mb-3">{children}</pre>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3 rounded-lg border border-gray-200">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-cdata-black">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-600 border-t border-gray-100">{children}</td>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-cdata-yellow pl-3 py-1 mb-3 bg-cdata-yellow/5 rounded-r-lg">
              {children}
            </blockquote>
          ),
          // Horizontal rules
          hr: () => <hr className="my-3 border-gray-200" />,
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400 transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
