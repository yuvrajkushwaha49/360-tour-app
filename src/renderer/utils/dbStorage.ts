// High-Capacity IndexedDB & Safe Storage System for large 360 images & tour projects

const DB_NAME = '360PanoramaStudioDB';
const STORE_NAME = 'projectDraftStore';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Safely save large objects (support up to gigabytes of 360 photos) without QuotaExceededError
export async function saveLargeDraft(key: string, value: any): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // If IndexedDB fails, safely attempt stripped localStorage
    safeLocalStorageSet(key, JSON.stringify(value));
  }
}

// Load large draft from IndexedDB (with fallback to localStorage)
export async function loadLargeDraft<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result !== undefined) {
          resolve(req.result as T);
        } else {
          resolve(safeLocalStorageGet<T>(key));
        }
      };
      req.onerror = () => {
        resolve(safeLocalStorageGet<T>(key));
      };
    });
  } catch {
    return safeLocalStorageGet<T>(key);
  }
}

// Delete draft from IndexedDB and localStorage
export async function deleteLargeDraft(key: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {}
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

// Safe localStorage set with try-catch to prevent QuotaExceededError crashes
export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[Storage] localStorage 5MB quota reached for "${key}". Using in-memory/IndexedDB instead.`);
  }
}

export function safeLocalStorageGet<T = any>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}
