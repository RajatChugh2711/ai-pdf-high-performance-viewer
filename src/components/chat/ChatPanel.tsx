import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectConversationByDocId,
  selectErrorDocId,
} from '../../features/chat/chatSelectors';
import { clearConversation, clearError } from '../../features/chat/chatSlice';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { DocumentRecord } from '../../types';
import { useStreamingChat } from '../../hooks/useStreamingChat';

interface ChatPanelProps {
  document: DocumentRecord;
}

export function ChatPanel({ document }: ChatPanelProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectConversationByDocId(document.id));
  const errorDocId = useAppSelector(selectErrorDocId);
  const { sendMessage } = useStreamingChat();

  const hasError = errorDocId === document.id;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  function handleClear() {
    dispatch(clearConversation(document.id));
  }

  function handleRetry() {
    dispatch(clearError());
    if (lastUserMessage) {
      void sendMessage(document.id, lastUserMessage.content);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-indigo-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-100 truncate">AI Chat</h3>
            <p className="text-xs text-gray-500 truncate">{document.name}</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded hover:bg-gray-800"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="mx-4 mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center justify-between">
          <p className="text-red-300 text-xs">Failed to get AI response.</p>
          <button
            onClick={handleRetry}
            className="text-xs text-red-300 hover:text-white underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList docId={document.id} />

      {/* Input */}
      <ChatInput docId={document.id} />
    </div>
  );
}
