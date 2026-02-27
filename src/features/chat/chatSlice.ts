import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ChatState, Message } from '../../types';

const initialState: ChatState = {
  conversations: {},
  streamingState: {
    docId: null,
    content: '',
    messageId: null,
  },
  isStreaming: false,
  errorDocId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addUserMessage(
      state,
      action: PayloadAction<{ docId: string; message: Message }>,
    ) {
      const { docId, message } = action.payload;
      if (!state.conversations[docId]) {
        state.conversations[docId] = [];
      }
      state.conversations[docId]!.push(message);
      state.errorDocId = null;
    },
    startStreaming(
      state,
      action: PayloadAction<{ docId: string; messageId: string }>,
    ) {
      state.streamingState = {
        docId: action.payload.docId,
        content: '',
        messageId: action.payload.messageId,
      };
      state.isStreaming = true;
      state.errorDocId = null;
    },
    appendStreamingToken(state, action: PayloadAction<string>) {
      state.streamingState.content += action.payload;
    },
    finalizeStreamingMessage(state) {
      const { docId, content, messageId } = state.streamingState;
      if (docId && messageId && content) {
        if (!state.conversations[docId]) {
          state.conversations[docId] = [];
        }
        const message: Message = {
          id: messageId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
        };
        state.conversations[docId]!.push(message);
      }
      state.streamingState = { docId: null, content: '', messageId: null };
      state.isStreaming = false;
    },
    cancelStreaming(state) {
      state.streamingState = { docId: null, content: '', messageId: null };
      state.isStreaming = false;
    },
    setStreamingError(state, action: PayloadAction<string>) {
      const docId = action.payload;
      state.streamingState = { docId: null, content: '', messageId: null };
      state.isStreaming = false;
      state.errorDocId = docId;
    },
    clearConversation(state, action: PayloadAction<string>) {
      state.conversations[action.payload] = [];
      if (state.streamingState.docId === action.payload) {
        state.streamingState = { docId: null, content: '', messageId: null };
        state.isStreaming = false;
      }
    },
    clearError(state) {
      state.errorDocId = null;
    },
  },
});

export const {
  addUserMessage,
  startStreaming,
  appendStreamingToken,
  finalizeStreamingMessage,
  cancelStreaming,
  setStreamingError,
  clearConversation,
  clearError,
} = chatSlice.actions;

export default chatSlice.reducer;
