export interface DocumentMetadata {
    pageCount: number;
}

export interface DocumentFile {
    id: string;
    name: string;
    size: number;
    pageCount: number;
    objectUrl: string;
    status: "uploading" | "processing" | "ready" | "error" | "restoring";
    metadata: DocumentMetadata | null;
    error: string | null;
    isCorrupted: boolean;
    uploadedAt: number;
  }
  
export interface DocumentsState {
    files: Record<string, DocumentFile>;
    activeDocumentId: string | null;
}