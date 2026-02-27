import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppDispatch } from '../app/hooks';
import {
  addUserMessage,
  appendStreamingToken,
  cancelStreaming,
  finalizeStreamingMessage,
  setStreamingError,
  startStreaming,
} from '../features/chat/chatSlice';
import { mockAIQuery } from '../lib/mockBackend';

const TOKEN_INTERVAL_MS = 24; // ~60 fps feel
const CHARS_PER_TICK = 2;    // 2 chars × 60fps ≈ 120 chars/sec — smooth, readable

export function useStreamingChat() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStreaming = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (docId: string, question: string) => {
      if (!question.trim()) return;

      // Add user message
      const userMessageId = uuidv4();
      dispatch(
        addUserMessage({
          docId,
          message: {
            id: userMessageId,
            role: 'user',
            content: question.trim(),
            timestamp: Date.now(),
          },
        }),
      );

      // Start streaming AI response
      const assistantMessageId = uuidv4();
      dispatch(startStreaming({ docId, messageId: assistantMessageId }));

      try {
        const fullResponse = await mockAIQuery(docId, question);

        let charIndex = 0;
        stopStreaming();

        intervalRef.current = setInterval(() => {
          if (charIndex >= fullResponse.length) {
            stopStreaming();
            dispatch(finalizeStreamingMessage());
            return;
          }

          const chunk = fullResponse.slice(
            charIndex,
            charIndex + CHARS_PER_TICK,
          );
          dispatch(appendStreamingToken(chunk));
          charIndex += CHARS_PER_TICK;
        }, TOKEN_INTERVAL_MS);
      } catch (err) {
        stopStreaming();
        dispatch(setStreamingError(docId));
        console.error('AI query failed:', err);
      }
    },
    [dispatch, stopStreaming],
  );

  const abort = useCallback(() => {
    stopStreaming();
    dispatch(cancelStreaming());
  }, [dispatch, stopStreaming]);

  return { sendMessage, abort };
}
