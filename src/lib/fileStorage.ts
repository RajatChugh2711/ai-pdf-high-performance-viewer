/**
 * Thin IndexedDB wrapper for persisting raw PDF File objects across page
 * refreshes. localStorage cannot hold binary data of this size (quota ~5 MB),
 * so IndexedDB is the correct storage layer here.
 *
 * Files are stored as a plain serialisable envelope { name, type,
 * lastModified, buffer } so that fake-indexeddb (used in tests) and older
 * browser engines that do not fully implement the structured-clone algorithm
 * for File objects all behave consistently.
 *
 * A single shared DB promise is cached at module level so the database is
 * opened at most once per session regardless of how many files are stored.
 */

const DB_NAME = 'adt_pdf_files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

interface StoredEntry {
  name: string;
  type: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/** Read a File into an ArrayBuffer using FileReader (works in all environments). */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as ArrayBuffer));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsArrayBuffer(file);
  });
}

/** Persist a File under `id`. Overwrites silently if the key already exists. */
export async function storeFile(id: string, file: File): Promise<void> {
  const buffer = await readAsArrayBuffer(file);
  const entry: StoredEntry = {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    buffer,
  };

  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve a previously stored File, or `null` if not found. */
export async function retrieveFile(id: string): Promise<File | null> {
  const db = await openDB();
  return new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const entry = req.result as StoredEntry | undefined;
      if (!entry) {
        resolve(null);
        return;
      }
      const file = new File([entry.buffer], entry.name, {
        type: entry.type,
        lastModified: entry.lastModified,
      });
      resolve(file);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Remove a file from IndexedDB (called when the user removes a document). */
export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
