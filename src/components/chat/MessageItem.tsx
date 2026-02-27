import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';
import type { Components } from 'react-markdown';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const markdownComponents: Components = {
  code(props) {
    const { className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className ?? '');
    const content = String(children).replace(/\n$/, '');
    // Inline code is single-line and has no language class.
    // Fenced blocks always contain newlines even when no language is specified.
    const isInline = !match && !content.includes('\n');

    if (isInline) {
      return (
        <code className="bg-gray-800 text-indigo-300 px-1 py-0.5 rounded text-sm font-mono break-all" {...rest}>
          {children}
        </code>
      );
    }

    if (match) {
      // Fenced block with language — use syntax highlighting
      return (
        <div className="overflow-x-auto my-2 rounded-lg">
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            className="rounded-lg! m-0! text-sm"
          >
            {content}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Fenced block without a language specifier — plain styled pre block
    return (
      <pre className="overflow-x-auto w-62.5 my-2 bg-gray-900 rounded-lg p-3 text-sm text-gray-300 font-mono">
        <code {...rest}>{content}</code>
      </pre>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm">{children}</li>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-white">{children}</strong>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold mb-2">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-bold mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-bold mb-1">{children}</h3>;
  },
};

export const MessageItem = memo(function MessageItem({
  message,
  isStreaming = false,
}: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 mt-1 mr-2">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3.5" />
          </svg>
        </div>
      )}

      <div className={`max-w-[80%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div
          className={`
            rounded-2xl px-4 py-2.5 text-sm
            ${isUser
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : `bg-gray-800 text-gray-100 rounded-bl-sm ${message.isError ? 'border border-red-700/50' : ''}`
            }
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.isError ? (
            <p className="text-red-300">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-600 mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1 ml-2">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
});
