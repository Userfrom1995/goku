import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'goku';
const DB_VERSION = 1;

export interface ModelRecord {
  id: string;
  name: string;
  repo: string;
  file: string;
  url: string;
  sizeBytes: number;
  quantization: string;
  architecture: string;
  contextLength: number;
  totalLayers: number;
  parameterCount: string;
  downloadedAt: number;
  storageKey: string;
}

interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  messages: ChatMessageRecord[];
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface DeviceOverridesRecord {
  id: string;
  ram?: number;
  cores?: number;
  storage?: number;
  tier?: 'low' | 'medium' | 'high';
}

let dbPromise: IDBPDatabase | null = null;

async function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chatSessions')) {
        const store = db.createObjectStore('chatSessions', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('deviceOverrides')) {
        db.createObjectStore('deviceOverrides', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

// Model metadata
export async function saveModel(model: ModelRecord): Promise<void> {
  const db = await getDB();
  await db.put('models', model);
}

export async function getModel(id: string): Promise<ModelRecord | undefined> {
  const db = await getDB();
  return db.get('models', id);
}

export async function getAllModels(): Promise<ModelRecord[]> {
  const db = await getDB();
  return db.getAll('models');
}

export async function deleteModel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('models', id);
}

// Chat sessions
export async function saveChatSession(session: ChatSessionRecord): Promise<void> {
  const db = await getDB();
  await db.put('chatSessions', session);
}

export async function getChatSession(id: string): Promise<ChatSessionRecord | undefined> {
  const db = await getDB();
  return db.get('chatSessions', id);
}

export async function getAllChatSessions(): Promise<ChatSessionRecord[]> {
  const db = await getDB();
  const sessions = await db.getAll('chatSessions');
  return sessions.sort((a: ChatSessionRecord, b: ChatSessionRecord) => b.updatedAt - a.updatedAt);
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('chatSessions', id);
}

// Device overrides
export async function saveDeviceOverrides(overrides: DeviceOverridesRecord): Promise<void> {
  const db = await getDB();
  await db.put('deviceOverrides', overrides);
}

export async function getDeviceOverrides(): Promise<DeviceOverridesRecord | undefined> {
  const db = await getDB();
  return db.get('deviceOverrides', 'user');
}
