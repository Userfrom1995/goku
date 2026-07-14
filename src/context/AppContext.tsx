import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { ModelMetadata, ChatMessage, ChatSession, GenerationSettings, EngineStatus, DeviceCapabilities, DownloadTask } from '../types';
import { createWllamaEngine, type WllamaEngine } from '../engine/wllama';
import { getWllamaCacheStore } from '../storage/wllamaCache';
import * as db from '../storage/db';
import { detectDeviceCapabilities, loadOverrides } from '../utils/resourceCheck';
import { toast } from '../utils/toast';

export type Tab = 'chat' | 'models';

interface AppState {
  tab: Tab;
  models: ModelMetadata[];
  activeModelId: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  engine: EngineStatus;
  generation: GenerationSettings;
  device: DeviceCapabilities;
  sidebarOpen: boolean;
  downloads: DownloadTask[];
  modelContextOverrides: Record<string, number>; // modelId -> context length
}

type Action =
  | { type: 'SET_TAB'; tab: Tab }
  | { type: 'SET_MODELS'; models: ModelMetadata[] }
  | { type: 'ADD_MODEL'; model: ModelMetadata }
  | { type: 'UPDATE_MODEL'; model: ModelMetadata }
  | { type: 'DELETE_MODEL'; id: string }
  | { type: 'SET_ACTIVE_MODEL'; id: string | null }
  | { type: 'SET_SESSIONS'; sessions: ChatSession[] }
  | { type: 'ADD_SESSION'; session: ChatSession }
  | { type: 'UPDATE_SESSION'; session: ChatSession }
  | { type: 'DELETE_SESSION'; id: string }
  | { type: 'SET_ACTIVE_SESSION'; id: string | null }
  | { type: 'SET_ENGINE'; engine: Partial<EngineStatus> }
  | { type: 'SET_GENERATION'; generation: Partial<GenerationSettings> }
  | { type: 'SET_MODEL_CONTEXT'; modelId: string; contextLength: number }
  | { type: 'SET_DEVICE'; device: DeviceCapabilities }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'ADD_DOWNLOAD'; task: DownloadTask }
  | { type: 'UPDATE_DOWNLOAD'; id: string; update: Partial<DownloadTask> }
  | { type: 'REMOVE_DOWNLOAD'; id: string };

const initialState: AppState = {
  tab: 'chat',
  models: [],
  activeModelId: null,
  sessions: [],
  activeSessionId: null,
  engine: { state: 'idle', modelId: null, progress: 0, error: null, tokensPerSecond: 0, backend: null, loadedContextLength: 0 },
  generation: { temperature: 0.7, contextLength: 2048, topP: 0.9, topK: 40, systemPrompt: '', nGpuLayers: 99999, gpuEnabled: true, gpuAdaptive: true },
  device: { ram: 4, ramDetected: false, storage: 0, hasWebGPU: false, tier: 'medium', isAutoDetected: true },
  sidebarOpen: true,
  downloads: [],
  modelContextOverrides: {},
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TAB': return { ...state, tab: action.tab };
    case 'SET_MODELS': return { ...state, models: action.models };
    case 'ADD_MODEL': return { ...state, models: [...state.models, action.model] };
    case 'UPDATE_MODEL': return {
      ...state,
      models: state.models.map(m => m.id === action.model.id ? action.model : m)
    };
    case 'DELETE_MODEL': {
      const models = state.models.filter(m => m.id !== action.id);
      const activeModelId = state.activeModelId === action.id ? null : state.activeModelId;
      return { ...state, models, activeModelId };
    }
    case 'SET_ACTIVE_MODEL': return { ...state, activeModelId: action.id };
    case 'SET_SESSIONS': return { ...state, sessions: action.sessions };
    case 'ADD_SESSION': return { ...state, sessions: [action.session, ...state.sessions] };
    case 'UPDATE_SESSION': {
      const sessions = state.sessions.map(s => s.id === action.session.id ? action.session : s);
      return { ...state, sessions };
    }
    case 'DELETE_SESSION': {
      const sessions = state.sessions.filter(s => s.id !== action.id);
      const activeSessionId = state.activeSessionId === action.id ? null : state.activeSessionId;
      return { ...state, sessions, activeSessionId };
    }
    case 'SET_ACTIVE_SESSION': return { ...state, activeSessionId: action.id };
    case 'SET_ENGINE': return { ...state, engine: { ...state.engine, ...action.engine } };
    case 'SET_GENERATION': return { ...state, generation: { ...state.generation, ...action.generation } };
    case 'SET_MODEL_CONTEXT': return {
      ...state,
      modelContextOverrides: { ...state.modelContextOverrides, [action.modelId]: action.contextLength }
    };
    case 'SET_DEVICE': return { ...state, device: action.device };
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'ADD_DOWNLOAD': return { ...state, downloads: [...state.downloads, action.task] };
    case 'UPDATE_DOWNLOAD': {
      const downloads = state.downloads.map(d => d.id === action.id ? { ...d, ...action.update } : d);
      return { ...state, downloads };
    }
    case 'REMOVE_DOWNLOAD': {
      return { ...state, downloads: state.downloads.filter(d => d.id !== action.id) };
    }
    default: return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  engineRef: React.MutableRefObject<WllamaEngine>;
  loadModelToEngine: (modelId: string) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  createNewSession: () => void;
  deleteModel: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  exportSession: (id: string) => void;
  importSession: (json: string) => Promise<void>;
  cancelDownload: (id: string) => void;
  clearAllCache: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const engineRef = useRef<WllamaEngine>(createWllamaEngine());

  useEffect(() => {
    (async () => {
      const [models, sessions, overrides] = await Promise.all([
        db.getAllModels(),
        db.getAllChatSessions(),
        Promise.resolve(loadOverrides()),
      ]);
      dispatch({ type: 'SET_MODELS', models });
      dispatch({ type: 'SET_SESSIONS', sessions });
      const device = await detectDeviceCapabilities(overrides || undefined);
      dispatch({ type: 'SET_DEVICE', device });
    })();
  }, []);

  const loadModelToEngine = useCallback(async (modelId: string) => {
    const model = state.models.find(m => m.id === modelId);
    if (!model) return;

    dispatch({ type: 'SET_ENGINE', engine: { state: 'loading', modelId, progress: 0, error: null } });
    try {
      const cache = await getWllamaCacheStore();
      const blob = await cache.load(model.url);
      if (!blob) throw new Error('Model file not found. Please re-download.');

      const gpuLayers = state.generation.gpuEnabled
        ? (state.generation.gpuAdaptive ? 99999 : state.generation.nGpuLayers)
        : 0;

      // Use per-model context override, or model's max, or default 2048
      const contextLength = state.modelContextOverrides[modelId] || model.contextLength || 2048;

      const backend = await engineRef.current.loadModelFromBlob(
        blob,
        contextLength,
        gpuLayers,
        state.generation.gpuAdaptive
      );

      if (backend.gpuFailed) {
        toast('GPU failed to allocate. Model loaded on CPU instead.', 'error');
      }

      // Update model's contextLength and totalLayers with real values from wllama
      const needsUpdate =
        (backend.nCtxTrain && backend.nCtxTrain !== model.contextLength) ||
        (backend.totalLayers && backend.totalLayers !== model.totalLayers);

      if (needsUpdate) {
        const updatedModel = {
          ...model,
          contextLength: backend.nCtxTrain || model.contextLength,
          totalLayers: backend.totalLayers || model.totalLayers,
        };
        await db.saveModel(updatedModel);
        dispatch({ type: 'UPDATE_MODEL', model: updatedModel });
      }

      // Clamp override if it exceeds discovered nCtxTrain
      if (backend.nCtxTrain) {
        const currentOverride = state.modelContextOverrides[modelId];
        if (currentOverride && currentOverride > backend.nCtxTrain) {
          dispatch({ type: 'SET_MODEL_CONTEXT', modelId, contextLength: backend.nCtxTrain });
        }
      }

      dispatch({ type: 'SET_ENGINE', engine: { state: 'ready', progress: 100, backend, loadedContextLength: contextLength } });
      dispatch({ type: 'SET_ACTIVE_MODEL', id: modelId });
    } catch (err: any) {
      dispatch({ type: 'SET_ENGINE', engine: { state: 'error', error: err.message } });
    }
  }, [state.models, state.generation.nGpuLayers, state.generation.gpuEnabled, state.generation.gpuAdaptive, state.modelContextOverrides]);

  const createNewSession = useCallback(() => {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      modelId: state.activeModelId || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'ADD_SESSION', session });
    dispatch({ type: 'SET_ACTIVE_SESSION', id: session.id });
    db.saveChatSession({ ...session, messages: [] });
  }, [state.activeModelId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!state.activeModelId) return;

    let sessionId = state.activeSessionId;
    if (!sessionId) {
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: content.slice(0, 50),
        messages: [],
        modelId: state.activeModelId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      dispatch({ type: 'ADD_SESSION', session });
      dispatch({ type: 'SET_ACTIVE_SESSION', id: session.id });
      await db.saveChatSession({ ...session, messages: [] });
      sessionId = session.id;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      modelId: state.activeModelId,
    };

    const session = state.sessions.find(s => s.id === sessionId) || {
      id: sessionId!, title: content.slice(0, 50), messages: [], modelId: state.activeModelId,
      createdAt: Date.now(), updatedAt: Date.now(),
    };

    const updatedMessages = [...session.messages, userMsg];
    const updatedSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: session.messages.length === 0 ? content.slice(0, 50) : session.title,
    };
    dispatch({ type: 'UPDATE_SESSION', session: updatedSession });
    await db.saveChatSession(updatedSession);

    if (state.engine.state !== 'ready') {
      await loadModelToEngine(state.activeModelId);
    }

    dispatch({ type: 'SET_ENGINE', engine: { state: 'generating' } });

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      modelId: state.activeModelId,
    };

    const messages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
    if (state.generation.systemPrompt) {
      messages.unshift({ role: 'system', content: state.generation.systemPrompt });
    }

    try {
      let fullContent = '';
      await engineRef.current.generate(messages, {
        temperature: state.generation.temperature,
        maxTokens: state.engine.loadedContextLength - Math.ceil(JSON.stringify(messages).length / 4),
        topP: state.generation.topP,
        topK: state.generation.topK,
        onData: (text) => {
          fullContent += text;
          assistantMsg.content = fullContent;
          const currentSession = { ...updatedSession, messages: [...updatedMessages, assistantMsg], updatedAt: Date.now() };
          dispatch({ type: 'UPDATE_SESSION', session: currentSession });
        },
      });

      assistantMsg.timestamp = Date.now();
      const finalSession = { ...updatedSession, messages: [...updatedMessages, assistantMsg], updatedAt: Date.now() };
      dispatch({ type: 'UPDATE_SESSION', session: finalSession });
      await db.saveChatSession(finalSession);
      dispatch({ type: 'SET_ENGINE', engine: { state: 'ready' } });
    } catch (err: any) {
      dispatch({ type: 'SET_ENGINE', engine: { state: state.engine.state === 'generating' ? 'ready' : state.engine.state, error: err.message } });
    }
  }, [state.activeModelId, state.activeSessionId, state.sessions, state.engine.state, state.generation, loadModelToEngine]);

  const stopGeneration = useCallback(() => {
    engineRef.current.stop();
  }, []);

  const unloadModel = useCallback(async () => {
    await engineRef.current.unloadModel();
    dispatch({ type: 'SET_ENGINE', engine: { state: 'idle', modelId: null, progress: 0, error: null, backend: null } });
    dispatch({ type: 'SET_ACTIVE_MODEL', id: null });
  }, []);

  const cancelDownload = useCallback((id: string) => {
    const controllers = (window as any).__gokuAbortControllers || {};
    const controller = controllers[id];
    if (controller) {
      controller.abort();
      delete controllers[id];
    }
    dispatch({ type: 'UPDATE_DOWNLOAD', id, update: { status: 'error', error: 'Cancelled' } });
    setTimeout(() => dispatch({ type: 'REMOVE_DOWNLOAD', id }), 1000);
  }, []);

  const clearAllCache = useCallback(async () => {
    // Clear all models from DB
    const models = await db.getAllModels();
    for (const model of models) {
      await db.deleteModel(model.id);
    }

    // Clear all chat sessions from DB
    const sessions = await db.getAllChatSessions();
    for (const session of sessions) {
      await db.deleteChatSession(session.id);
    }

    // Clear OPFS/CacheManager
    try {
      const { getWllamaCacheStore } = await import('../storage/wllamaCache');
      const cache = await getWllamaCacheStore();
      const cm = new (await import('@wllama/wllama')).CacheManager();
      await cm.clear();
    } catch {
      // ignore
    }

    // Clear IndexedDB blob store
    try {
      const dbs = await indexedDB.databases();
      for (const dbInfo of dbs) {
        if (dbInfo.name) {
          indexedDB.deleteDatabase(dbInfo.name);
        }
      }
    } catch {
      // ignore
    }

    // Clear localStorage
    localStorage.clear();

    // Reset state
    dispatch({ type: 'SET_MODELS', models: [] });
    dispatch({ type: 'SET_SESSIONS', sessions: [] });
    dispatch({ type: 'SET_ACTIVE_MODEL', id: null });
    dispatch({ type: 'SET_ACTIVE_SESSION', id: null });
  }, []);

  const deleteModel = useCallback(async (id: string) => {
    const model = state.models.find(m => m.id === id);
    if (model) {
      const cache = await getWllamaCacheStore();
      await cache.delete(model.url);
    }
    await db.deleteModel(id);
    dispatch({ type: 'DELETE_MODEL', id });
  }, [state.models]);

  const deleteSession = useCallback(async (id: string) => {
    await db.deleteChatSession(id);
    dispatch({ type: 'DELETE_SESSION', id });
  }, []);

  const exportSession = useCallback((id: string) => {
    const session = state.sessions.find(s => s.id === id);
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goku-chat-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.sessions]);

  const importSession = useCallback(async (json: string) => {
    const session: ChatSession = JSON.parse(json);
    session.id = crypto.randomUUID();
    session.createdAt = session.createdAt || Date.now();
    session.updatedAt = Date.now();
    dispatch({ type: 'ADD_SESSION', session });
    await db.saveChatSession(session);
  }, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, engineRef,
      loadModelToEngine, unloadModel, sendMessage, stopGeneration,
      createNewSession, deleteModel, deleteSession,
      exportSession, importSession, cancelDownload, clearAllCache,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
