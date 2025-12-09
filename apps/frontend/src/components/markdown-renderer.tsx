'use client';

import { Chip } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './copy-button';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: Readonly<MarkdownRendererProps>) {
  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6 first:mt-0"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3 mt-5"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2 mt-4"
              {...props}
            >
              {children}
            </h3>
          ),

          p: ({ children, ...props }) => (
            <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed" {...props}>
              {children}
            </p>
          ),

          ul: ({ children, ...props }) => (
            <ul
              className="list-disc list-inside space-y-2 mb-4 text-gray-600 dark:text-gray-300"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="list-decimal list-inside space-y-2 mb-4 text-gray-600 dark:text-gray-300"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),

          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900 dark:text-white" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic text-gray-800 dark:text-gray-200" {...props}>
              {children}
            </em>
          ),

          code: ({ children, className, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const language = className?.replace('language-', '') || 'text';

            return (
              <div className="relative group mb-4">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-t-lg border border-gray-200 dark:border-gray-700">
                  <Chip size="sm" variant="flat" color="default">
                    {language}
                  </Chip>
                  <CopyButton
                    content={String(children).replace(/\n$/, '')}
                    size="sm"
                    variant="light"
                  />
                </div>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },

          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          ),

          table: ({ children, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full border-collapse border border-gray-300 dark:border-gray-600"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </td>
          ),

          hr: ({ ...props }) => (
            <hr className="border-gray-300 dark:border-gray-600 my-6" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
