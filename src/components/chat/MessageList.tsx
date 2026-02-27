import { useCallback, useEffect, useRef } from 'react';
import { useAppSelector } from '../../app/hooks';
import {
  selectConversationByDocId,
  selectIsStreaming,
  selectStreamingState,
} from '../../features/chat/chatSelectors';
import { MessageItem } from './MessageItem';
import type { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface MessageListProps {
  docId: string;
}

// Streaming bubble: separate component so only it re-renders during streaming
function StreamingBubble({ content }: { content: string }) {
  const streamingMessage: Message = {
    id: 'streaming',
    role: 'assistant',
    content,
    timestamp: Date.now(),
  };

  return <MessageItem message={streamingMessage} isStreaming />;
}

// Loading dots (when streaming is starting but no content yet)
function LoadingDots() {
  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 mt-1 mr-2">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3.5" />
        </svg>
      </div>
      <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
      </div>
    </div>
  );
}

export function MessageList({ docId }: MessageListProps) {
  const messages = useAppSelector(selectConversationByDocId(docId));
  const isStreaming = useAppSelector(selectIsStreaming);
  const streamingState = useAppSelector(selectStreamingState);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isThisDocStreaming = isStreaming && streamingState.docId === docId;

  // Auto-scroll to bottom on new messages or streaming content
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, streamingState.content, scrollToBottom]);

  if (messages.length === 0 && !isThisDocStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-300 font-medium text-sm">Ask about this document</p>
          <p className="text-gray-500 text-xs mt-1">
            Type a question below to get AI-powered insights from your PDF.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 scroll-smooth">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}

      {isThisDocStreaming && (
        streamingState.content
          ? <StreamingBubble key={uuidv4()} content={streamingState.content} />
          : <LoadingDots />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
