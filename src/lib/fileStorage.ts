/**
 * Thin IndexedDB wrapper for persisting raw PDF File objects across page
 * refreshes. localStorage cannot hold binary data of this size (quota ~5 MB),
 * so IndexedDB is the correct storage layer here.
 *
 * A single shared DB promise is cached at module level so the database is
 * opened at most once per session regardless of how many files are stored.
 */

const DB_NAME = 'adt_pdf_files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

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

/** Persist a File under `id`. Overwrites silently if the key already exists. */
export async function storeFile(id: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, id);
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
    req.onsuccess = () => resolve((req.result as File | undefined) ?? null);
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
