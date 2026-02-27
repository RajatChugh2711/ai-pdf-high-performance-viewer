// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  status: AuthStatus;
  sessionChecked: boolean;
  error: string | null;
}

// Document types
export type DocumentStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'error'
  | 'restoring';

export interface DocumentMetadata {
  // Core identity
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  // Software chain
  creator: string | null;   // Authoring tool (e.g. "Microsoft Word")
  producer: string | null;  // PDF library (e.g. "Adobe PDF Library")
  // Dates
  creationDate: string | null;
  modDate: string | null;
  // Technical
  pdfVersion: string | null;
  pageCount: number;
  fileSize: number;
}

export interface DocumentRecord {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  objectUrl: string;
  status: DocumentStatus;
  metadata: DocumentMetadata | null;
  error: string | null;
  isCorrupted: boolean;
  uploadedAt: number;
}

export interface DocumentsState {
  files: Record<string, DocumentRecord>;
  activeDocumentId: string | null;
}

// Chat types
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isError?: boolean;
}

export interface StreamingState {
  docId: string | null;
  content: string;
  messageId: string | null;
}

export interface ChatState {
  conversations: Record<string, Message[]>;
  streamingState: StreamingState;
  isStreaming: boolean;
  errorDocId: string | null;
}

// UI types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

export interface UIState {
  sidebarOpen: boolean;
  zoomLevel: number;
  notifications: Notification[];
}

// Worker message types
export interface WorkerParseRequest {
  id: string;
  arrayBuffer: ArrayBuffer;
}

export interface WorkerParseSuccess {
  id: string;
  metadata: DocumentMetadata;
}

export interface WorkerParseError {
  id: string;
  error: string;
  isCorrupted: boolean;
}

export type WorkerResult = WorkerParseSuccess | WorkerParseError;

// JWT payload
export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}
