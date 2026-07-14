interface ModelBlobStore {
  save(id: string, data: ArrayBuffer): Promise<void>;
  load(id: string): Promise<ArrayBuffer | null>;
  delete(id: string): Promise<void>;
  has(id: string): Promise<boolean>;
}

// OPFS implementation
async function opfsStore(): Promise<ModelBlobStore> {
  const root = await navigator.storage.getDirectory();

  return {
    async save(id, data) {
      const fileHandle = await root.getFileHandle(id, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    },
    async load(id) {
      try {
        const fileHandle = await root.getFileHandle(id);
        const file = await fileHandle.getFile();
        return file.arrayBuffer();
      } catch {
        return null;
      }
    },
    async delete(id) {
      try {
        await root.removeEntry(id);
      } catch {
        // ignore if not found
      }
    },
    async has(id) {
      try {
        await root.getFileHandle(id);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// IndexedDB fallback for model blobs
async function indexedDBBlobStore(): Promise<ModelBlobStore> {
  const DB_NAME = 'goku-blobs';
  const STORE_NAME = 'models';
  const { openDB } = await import('idb');
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });

  return {
    async save(id, data) {
      await db.put(STORE_NAME, data, id);
    },
    async load(id) {
      return (await db.get(STORE_NAME, id)) ?? null;
    },
    async delete(id) {
      await db.delete(STORE_NAME, id);
    },
    async has(id) {
      const key = await db.getKey(STORE_NAME, id);
      return key !== undefined;
    },
  };
}

let instance: ModelBlobStore | null = null;

export async function getModelBlobStore(): Promise<ModelBlobStore> {
  if (instance) return instance;

  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
    try {
      instance = await opfsStore();
      return instance;
    } catch {
      // fall through
    }
  }

  instance = await indexedDBBlobStore();
  return instance;
}
