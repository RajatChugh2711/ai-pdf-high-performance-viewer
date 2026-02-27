# DocChat AI — Trinetra Labs Frontend Assessment

A production-grade **AI Document Chat System** built with React 19 + TypeScript (strict) + Tailwind CSS v4 + Redux Toolkit. Upload PDF documents, view them in a virtualized reader, and ask questions answered by a simulated token-streaming AI.

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

**Demo credentials:** `demo@test.com` / `demo123`

**Build for production:**

```bash
npm run build
npm run preview
```

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Session Lifecycle Diagram](#2-session-lifecycle-diagram)
3. [State Flow Diagram](#3-state-flow-diagram)
4. [Design Decisions](#4-design-decisions)
   - 4.1 Redux Toolkit over Context API
   - 4.2 Web Worker for PDF Parsing
5. [Feature Walkthrough](#5-feature-walkthrough)
   - 5.1 PDF Virtualization (High Complexity)
   - 5.2 Token Refresh Queueing (High Complexity)
6. [Folder Structure](#6-folder-structure)
7. [Performance Optimisations](#7-performance-optimisations)
8. [Identified Bottlenecks](#8-identified-bottlenecks)
9. [Technology Justification](#9-technology-justification)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      React Component Tree                    │   │
│  │                                                              │   │
│  │   App                                                        │   │
│  │   └── BrowserRouter                                          │   │
│  │       ├── /login  → LoginPage → LoginForm                    │   │
│  │       └── /dashboard (ProtectedRoute)                        │   │
│  │           └── AppShell                                       │   │
│  │               ├── Header                                     │   │
│  │               └── DashboardPage                              │   │
│  │                   ├── DocumentSidebar ──────────────┐        │   │
│  │                   │   ├── PDFUploader               │        │   │
│  │                   │   └── DocumentList              │        │   │
│  │                   ├── PDFViewer (lazy) ─────────────┤        │   │
│  │                   │   └── react-window List         │        │   │
│  │                   │       └── PDFPage (memo) ×N     │        │   │
│  │                   └── ChatPanel (lazy) ─────────────┘        │   │
│  │                       ├── MessageList                        │   │
│  │                       │   └── MessageItem (memo) ×N         │   │
│  │                       └── ChatInput                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │ dispatch / select                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Redux Store                             │   │
│  │                                                              │   │
│  │   auth slice       documents slice    chat slice   ui slice  │   │
│  │   ─────────────    ───────────────    ──────────   ────────  │   │
│  │   token             files{}           convs{}      sidebar   │   │
│  │   refreshToken      activeDocId       streaming    zoom      │   │
│  │   user              status/error      isStreaming  notifs    │   │
│  │   sessionChecked    isCorrupted                             │   │
│  │                                                              │   │
│  │   localStorage middleware (debounced 300 ms)                 │   │
│  │   → persists chat.conversations + auth.refreshToken          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│  ┌───────────────┐   ┌──────────────────┐   ┌────────────────────┐  │
│  │  PDF Worker   │   │   apiClient.ts   │   │  mockBackend.ts    │  │
│  │  (separate    │   │   Axios +        │   │  login()           │  │
│  │   thread)     │   │   interceptors   │   │  refreshToken()    │  │
│  │               │   │   + pendingQueue │   │  aiQuery()         │  │
│  │  pdfjs-dist   │   │                  │   │  (500 ms delay)    │  │
│  │  parse+meta   │   │  401 → refresh   │   │                    │  │
│  └───────────────┘   │  → replay queue  │   └────────────────────┘  │
│                      └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Session Lifecycle Diagram

```
App Load
   │
   ▼
bootstrapSession()
   │
   ├── getTokens() from localStorage
   │       │
   │       ├── null ──────────────────────────────────► dispatch(logout())
   │       │                                                    │
   │       └── {token, refreshToken}                           │
   │               │                                           │
   │               ├── isTokenExpired(token) = false           │
   │               │       │                                   │
   │               │       └── dispatch(setTokens(...))        │
   │               │                                           │
   │               └── isTokenExpired(token) = true            │
   │                       │                                   │
   │                       ▼                                   │
   │               mockRefreshToken(refreshToken)              │
   │                       │                                   │
   │                       ├── success ──► dispatch(setTokens) │
   │                       │                                   │
   │                       └── failure ──► clearTokens()       │
   │                                       dispatch(logout())  │
   │                                                           │
   ▼                                                           ▼
dispatch(setSessionChecked(true)) ◄─────────────────────────────
   │
   ▼
ProtectedRoute evaluates
   │
   ├── status = 'authenticated' ──► render /dashboard
   └── status = 'unauthenticated' ──► redirect /login

─────────────────────────────────────────────────────────────────

Runtime 401 Handling (apiClient interceptor)
   │
   ▼
Request → 401 response
   │
   ├── config._retry = true ──► dispatch(logout()) [infinite loop guard]
   │
   ├── isRefreshing = true ──► push to pendingQueue [concurrent guard]
   │
   └── isRefreshing = false
           │
           ▼
       mockRefreshToken()
           │
           ├── success
           │     ├── flushQueue(null, newToken)  [replay all queued]
           │     ├── isRefreshing = false
           │     └── replay original (config._retry = true)
           │
           └── failure
                 ├── flushQueue(error)           [reject all queued]
                 ├── isRefreshing = false
                 └── dispatch(logout())
```

---

## 3. State Flow Diagram

```
PDF Upload Flow
──────────────
User drops file
    │
    ▼
PDFUploader.handleFiles()
    ├── validateFile() ──► error? ──► addNotification(error)
    ├── URL.createObjectURL(file) ──► objectUrl
    ├── fileMap.set(id, file)          [raw File outside Redux]
    ├── dispatch(addDocument({id, name, size, objectUrl}))
    └── parseFile(id, file)
            │
            ▼
    file.arrayBuffer()
            │
            ▼ [transferred, zero-copy]
    pdfParser.worker.ts  [separate thread — main thread never blocks]
            │
            ├── pdfjsLib.getDocument(arrayBuffer)
            ├── getMetadata() → title, author, subject, keywords,
            │                   creator, producer, creationDate,
            │                   modDate, pdfVersion
            │
            ├── success ──► postMessage(WorkerParseSuccess)
            │                    │
            │                    ▼
            │               dispatch(updateDocumentMetadata)
            │               → doc.status = 'ready'
            │               → doc.pageCount, doc.metadata filled
            │
            └── failure ──► classifyError() → isCorrupted?
                             postMessage(WorkerParseError)
                                  │
                                  ▼
                             dispatch(setDocumentError)
                             → doc.status = 'error'
                             → doc.isCorrupted = true/false
                             → distinct UI per type

─────────────────────────────────────────────────────────────────

AI Chat Streaming Flow
──────────────────────
User submits question
    │
    ▼
useStreamingChat.sendMessage(docId, question)
    │
    ├── dispatch(addUserMessage)           [persisted via middleware]
    ├── dispatch(startStreaming({docId, messageId}))
    │
    ▼
mockAIQuery(docId, question)              [~200 ms delay]
    │
    ▼
setInterval (every 20 ms, 3 chars/tick)
    │
    ├── dispatch(appendStreamingToken(chunk))
    │       │
    │       └── streamingState.content grows
    │               │
    │               └── only StreamingBubble re-renders
    │                   (MessageList is NOT re-rendered)
    │
    └── done?
            │
            ▼
    dispatch(finalizeStreamingMessage())
    → moves content into conversations[docId]
    → streamingState reset to null
    → localStorage middleware persists conversations

─────────────────────────────────────────────────────────────────

Redux Persistence
─────────────────
Every dispatch
    │
    └── localStorageMiddleware
            │
            ├── action starts with 'chat/'?
            │       └── debouncedSave(conversations, 300ms)
            │
            └── tokenManager.storeTokens() called on
                setTokens / login success / refresh success
                → base64-encoded in localStorage
```

---

## 4. Design Decisions

### 4.1 Redux Toolkit over Context API

The assignment specifies "state management discipline." Here is why Redux Toolkit was chosen over React Context:

| Concern | Context API | Redux Toolkit |
|---|---|---|
| **Cross-slice dependencies** | Requires nested providers or prop drilling when auth state affects document + chat state | Single store; selectors compose across slices with `createSelector` |
| **Middleware** | No built-in middleware layer; localStorage persistence requires `useEffect` in every consumer | Custom middleware intercepts every action — localStorage writes in one place, debounced |
| **Derived state memoisation** | `useMemo` scattered across components; referential stability breaks on any provider re-render | `createSelector` memoises at the selector level; components re-render only when their specific slice changes |
| **DevTools** | No time-travel debugging | Redux DevTools Extension gives full action history, state diff, and time-travel |
| **Async patterns** | `useReducer` + manual loading/error booleans per feature | `createAsyncThunk` standardises `pending / fulfilled / rejected` lifecycle in the slice |
| **Serialisation guard** | None | RTK's `serializableCheck` middleware catches accidental non-serialisable values (e.g., raw `File` objects) at runtime |
| **Scale** | Re-render propagation is hard to contain; every Context consumer re-renders when any value in the context changes | `useSelector` with fine-grained selectors means a chat message update never re-renders the PDF toolbar |

**Concrete example:** The token-refresh flow in `apiClient.ts` calls `store.getState()` and `store.dispatch()` outside of any React component. This is impossible with Context — the Context value is only accessible inside the React tree. Redux's singleton `store` object makes this pattern safe and straightforward.

### 4.2 Web Worker for PDF Parsing

PDF parsing with `pdfjs-dist` is CPU-bound: decoding cross-reference tables, decompressing object streams, and parsing content streams can block the main thread for 200–2000 ms on large files. Blocking the main thread during this window causes:

- The browser to drop animation frames (visible jank)
- Input events (typing, scrolling) to queue and replay in a burst after parsing finishes
- React's reconciler to stall, making the entire UI unresponsive

**Why a Worker solves this:**

```
Without Worker                     With Worker
──────────────                     ───────────
Main thread:                       Main thread:
  render UI   ████░░░░░░░████         render UI   ████████████████
  parse PDF       ░░░░░░░               (not blocked)

Worker thread:
                                      parse PDF       ░░░░░░░░
                                      postMessage ──► dispatch()
```

The `ArrayBuffer` is **transferred** (not copied) to the worker via the structured clone transfer list, making the operation zero-copy regardless of file size. The worker posts back only a small metadata object (~200 bytes), so the return path is also cheap.

Additionally, the worker is created once (`usePDFWorker` mounts it on the dashboard) and reused for all uploads in the session — there is no per-file worker instantiation overhead.

**Why not a Service Worker or SharedWorker?** A Dedicated Worker is the right scope here: the parsing is per-session, per-tab, and does not need to be shared across tabs or cached between sessions.

---

## 5. Feature Walkthrough

### 5.1 PDF Virtualization (High Complexity)

**Problem:** A 300-page PDF rendered naively creates 300 canvas elements simultaneously. A single A4 page at 1× zoom is ~595 × 842 px; at 2× it is a 2388 × 3368 px canvas (8 MP). 300 such canvases exhaust GPU memory and cause tab crashes.

**Solution — `react-window` `List` with dynamic row heights:**

```
Viewport (visible)
┌────────────────────────────────┐
│  ┌──────────────────────────┐  │  ← overscan row (pre-rendered, hidden)
│  │       Page 3             │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │  ← visible
│  │       Page 4             │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │  ← visible
│  │       Page 5             │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │  ← overscan row (pre-rendered, hidden)
│  │       Page 6             │  │
└────────────────────────────────┘

Pages 1–2, 7–300: not in DOM at all
```

Only `overscanCount={2}` pages beyond the viewport are kept in the DOM. For a 300-page document, at any point ≤ 7 canvas elements exist simultaneously.

**Height cache** (`heightCacheRef: Map<index, px>`): `pdfjs` reports the actual rendered viewport height for each page after the first render. This is written to the cache via `useCallback`-stabilised `onHeightMeasured` — the cache is a `useRef` (not state), so writes never trigger React re-renders. The `List`'s `rowHeight` function reads from this cache on subsequent renders.

**Zoom handling:** When `zoomLevel` changes, the height cache is cleared and the `List` recalculates all estimated heights using the new scale factor. Active canvas renders are cancelled via `renderTask.cancel()` and restarted at the new scale.

**Page prefetch:** `useEffect([currentPage])` calls `pdfDoc.getPage(N+1)` and `getPage(N+2)` ahead of the viewport. pdfjs caches parsed page objects internally, so when the List scrolls to those pages they render immediately without a parsing round-trip.

**`React.memo` + stable `onHeightMeasured` callback:** `PDFPage` is wrapped in `React.memo`. The callback passed to it (`handleHeight`) is created inside `PDFRow` via `useCallback([onHeightMeasured, index])`. Because `onHeightMeasured` itself is a module-level stable `useCallback([], [])`, the per-row `handleHeight` only changes if `index` changes — which it cannot for a given row instance. Result: `PDFPage` bails out of re-render during scrolling, keeping frame rendering time below 16 ms.

### 5.2 Token Refresh Queueing (High Complexity)

**Problem:** In a realistic app, multiple API requests fire simultaneously (e.g., document list + user profile + analytics). If all of them return 401 simultaneously, naively each would attempt its own refresh, causing:
- Multiple concurrent `refreshToken` calls → only the first succeeds; the rest fail with "invalid refresh token" (refresh tokens are single-use)
- Each failure triggers its own `logout()` dispatch → multiple React re-renders
- Race between the successful refresh writing new tokens and the failed refreshes reading the old (now-invalidated) tokens

**Solution — single-flight refresh with queued replay:**

```
Request A ──► 401
Request B ──► 401    All arrive simultaneously
Request C ──► 401

Interceptor (Request A — first to arrive):
  isRefreshing = false → becomes the "leader"
  isRefreshing = true
  → calls mockRefreshToken()

Interceptor (Request B, C — arrive while A is refreshing):
  isRefreshing = true → pushed to pendingQueue
  → return new Promise (suspended)

refreshToken() resolves:
  flushQueue(null, newToken)
  → snapshot pendingQueue (prevents mid-flush push races)
  → B: config.headers.Authorization = Bearer <newToken>
       resolve(apiClient(config))  [replayed]
  → C: same
  isRefreshing = false
  → A: replayed with config._retry = true

Result: exactly 1 refresh call, all 3 requests succeed
```

**Infinite-loop guard:** The replayed request carries `config._retry = true`. If the server returns 401 again on the replay (e.g., the new token is also rejected), the interceptor sees `_retry` and dispatches `logout()` instead of retrying. This is a per-request flag — it does not leak between sessions.

**Memory bound:** The `pendingQueue` only grows during the ~300 ms refresh window. `flushQueue` always drains it completely on both success and failure paths. After the refresh window the queue is always empty.

---

## 6. Folder Structure

```
src/
├── app/
│   ├── store.ts              Redux store + localStorage middleware
│   └── hooks.ts              Typed useAppDispatch / useAppSelector
├── features/
│   ├── auth/
│   │   ├── authSlice.ts      token, user, status, sessionChecked
│   │   └── authSelectors.ts  createSelector memoised
│   ├── documents/
│   │   ├── documentsSlice.ts DocumentRecord[], activeDocumentId
│   │   └── documentsSelectors.ts
│   ├── chat/
│   │   ├── chatSlice.ts      conversations per docId, streaming state
│   │   └── chatSelectors.ts
│   └── ui/
│       ├── uiSlice.ts        sidebar, zoom, notifications
│       └── uiSelectors.ts
├── lib/
│   ├── apiClient.ts          Axios + interceptors + pendingQueue
│   ├── tokenManager.ts       store/retrieve/decode/expire JWT
│   ├── mockBackend.ts        mock login, refresh, AI (Promise delays)
│   └── sessionManager.ts     bootstrap session on app start
├── workers/
│   └── pdfParser.worker.ts   Web Worker: parse PDF, classify corruption
├── hooks/
│   ├── useAuth.ts            login, logout, session state
│   ├── usePDFWorker.ts       send file → worker, receive metadata
│   └── useStreamingChat.ts   token-by-token streaming simulation
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pdf/
│   │   ├── PDFUploader.tsx   drag-and-drop, validation, multi-file
│   │   ├── PDFViewer.tsx     react-window List, zoom, navigation
│   │   ├── PDFPage.tsx       React.memo, pdfjs canvas, cancel on unmount
│   │   └── DocumentSidebar.tsx
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── MessageList.tsx   auto-scroll, streaming bubble
│   │   ├── MessageItem.tsx   React.memo, react-markdown, syntax highlight
│   │   └── ChatInput.tsx     auto-resize textarea, Enter/Shift+Enter
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   └── Header.tsx
│   └── ui/
│       ├── ErrorBoundary.tsx class component, wraps PDFViewer + ChatPanel
│       └── NotificationStack.tsx auto-dismiss toasts
├── pages/
│   ├── LoginPage.tsx
│   └── DashboardPage.tsx     split layout, React.lazy code split
└── types/
    └── index.ts              Auth, Document, Message, UI, Worker types
```

---

## 7. Performance Optimisations

| Technique | Where | Effect |
|---|---|---|
| `react-window` List | PDFViewer, MessageList | O(visible) DOM nodes instead of O(total) |
| `React.memo` | PDFPage, MessageItem | Skip re-render when props unchanged |
| `useCallback` stable refs | PDFRow → PDFPage | Preserves memo bailout during scroll |
| `createSelector` | All selectors | Memoised derived state; referential stability |
| Web Worker | pdfParser.worker.ts | PDF parsing never blocks main thread |
| `ArrayBuffer` transfer | usePDFWorker | Zero-copy file transfer to worker |
| `React.lazy` + Suspense | PDFViewer, ChatPanel | Code-split; only loaded after login |
| Debounced localStorage | store.ts middleware | Max 1 write per 300 ms regardless of dispatch rate |
| Debounced page indicator | PDFViewer onRowsRendered | Max 10 setState/s during fast scroll instead of 60 |
| Automatic batching | React 18 | Multiple dispatches in async callbacks batched into one render |
| Page prefetch | PDFViewer useEffect | pdfjs caches N+1, N+2 so they render instantly |
| `renderTask.cancel()` | PDFPage cleanup | Cancelled renders free GPU/CPU immediately on scroll |
| `URL.revokeObjectURL` | removeDocument | Object URLs freed on document removal |

---

## 8. Identified Bottlenecks

These are known limitations that virtualization and React optimisations cannot fully eliminate:

**8.1 High-resolution PDF canvas rendering**
Pages with vector art or large raster images at zoom ≥ 2× produce canvases exceeding 4 MP (e.g., 2388 × 3368 px at 2× scale). The GPU must allocate a texture for each visible canvas. On integrated GPUs or mobile hardware, 3–4 such canvases simultaneously can saturate VRAM and cause frame drops below 60 fps. Mitigation: cap zoom at 3×; cancel in-flight renders immediately on zoom change.

**8.2 pdfjs page decode latency on first access**
The first call to `pdfDoc.getPage(n)` for a page that has never been accessed parses that page's content stream. For pages with complex typography or embedded fonts, this takes 50–200 ms even in the worker. Prefetching N+1 / N+2 masks this for normal reading speed but cannot cover rapid manual jumps (e.g., jumping from page 1 to page 150 directly).

**8.3 react-window dynamic height estimation during fast scroll**
The `rowHeight` function returns an estimated height (default A4 × scale) for pages that have not yet been rendered. If many pages have non-standard dimensions (landscape, A3), the estimated heights diverge from the real heights, causing the scroll position to shift when actual heights are written into the cache. This is a known limitation of estimated-height virtualisation and would require a two-pass layout (measure-then-render) or ResizeObserver integration to fully resolve.

**8.4 Streaming chat re-renders**
`appendStreamingToken` is dispatched every 20 ms. Although only `StreamingBubble` re-renders (isolated from `MessageList`), the Redux middleware still fires on each tick, running `debouncedSave`. The debounce absorbs this, but 50 dispatches/second is above what most Redux apps generate. Mitigation: buffer tokens client-side and dispatch in larger chunks (100–200 ms batches) while keeping the visual tick rate high via local state.

**8.5 localStorage quota**
Chat conversations are persisted indefinitely. A session with 50 documents × 100 messages each at 500 chars/message uses ~2.5 MB of the 5–10 MB localStorage quota. No eviction policy is currently implemented. Production fix: cap conversations per document, or evict oldest conversations when quota is nearing saturation.

**8.6 Single-file object URL lifetime**
`URL.createObjectURL(file)` returns a URL valid for the page session. If the user navigates away and back (SPA routing), the object URL remains valid. However, if the tab is reloaded, the object URLs are invalidated and `DocumentRecord.objectUrl` in Redux (which was not persisted) becomes a dead reference, causing the viewer to show a load error. Fix: persist the raw file to IndexedDB and regenerate the object URL on session restore.

---

## 9. Technology Justification

| Technology | Version | Justification |
|---|---|---|
| **Vite** | 7 | Sub-200 ms HMR; native ES module worker support via `new URL(…, import.meta.url)` |
| **React** | 19 | Automatic batching; concurrent rendering; `useTransition` available for future deferred page updates |
| **TypeScript strict** | 5.9 | `noUncheckedSideEffectImports`, `erasableSyntaxOnly`; catches null dereferences that would cause runtime 401 hangs |
| **Redux Toolkit** | 2 | See §4.1 — state discipline, middleware, DevTools, cross-slice composition |
| **pdfjs-dist** | 5 | De-facto standard; supports PDF 2.0, XFA, encrypted PDFs; exposes `RenderTask.cancel()` for abort |
| **react-window** | 2 | ResizeObserver-based dynamic sizing; no fixed-height requirement |
| **react-markdown** | 10 | Sanitised rendering; `components` prop lets us intercept `code` blocks for syntax highlighting |
| **Tailwind CSS** | 4 | PostCSS-only (no config file); `@layer` utilities for custom scrollbars |
| **Axios** | 1 | Interceptor API is stable and testable; built-in request/response transformation; easier to mock than `fetch` in tests |

---

## Verification Checklist

- [ ] `npm run dev` → app loads at `http://localhost:5173`
- [ ] Login with `demo@test.com` / `demo123` → redirected to dashboard
- [ ] Upload a valid PDF → metadata panel shows title, author, page count
- [ ] Upload a corrupted file → orange "Corrupted" badge + specific error UI
- [ ] Chat with document → streaming response appears token-by-token
- [ ] Stop button aborts streaming mid-response
- [ ] Refresh page → session restored, messages persisted
- [ ] Zoom in/out → PDF re-renders at new scale
- [ ] Jump to page → smooth scroll for ≤30 pages, instant for large jumps
- [ ] Sign out → redirected to login, localStorage cleared
- [ ] Multiple tabs → each tab maintains independent state
