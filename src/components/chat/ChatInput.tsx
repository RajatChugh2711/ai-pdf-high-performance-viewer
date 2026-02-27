import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectIsStreaming } from '../../features/chat/chatSelectors';
import { useStreamingChat } from '../../hooks/useStreamingChat';

interface ChatInputProps {
  docId: string;
}

export function ChatInput({ docId }: ChatInputProps) {
  const [input, setInput] = useState('');
  const isStreaming = useAppSelector(selectIsStreaming);
  const { sendMessage, abort } = useStreamingChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(docId, text);
  }, [input, isStreaming, docId, sendMessage]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-4 py-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this document..."
            rows={1}
            disabled={isStreaming}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              resize-none disabled:opacity-50 disabled:cursor-not-allowed transition max-h-40 leading-relaxed"
          />
        </div>

        {isStreaming ? (
          <button
            onClick={abort}
            className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition flex-shrink-0"
            title="Stop generating"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => { void handleSend(); }}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition
              flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send message (Enter)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-1.5 text-center">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
