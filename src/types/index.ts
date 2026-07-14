export interface ModelMetadata {
  id: string;
  name: string;
  repo: string;
  file: string;
  url: string;
  sizeBytes: number;
  quantization: string;
  architecture: string;
  contextLength: number; // Model's max context from GGUF
  totalLayers: number; // Model's total layers (from GGUF or discovered after load)
  parameterCount: string;
  downloadedAt: number;
  storageKey: string;
}

export interface DeviceCapabilities {
  ram: number;
  ramDetected: boolean; // true = Chromium navigator.deviceMemory, false = guessed from UA
  storage: number;
  hasWebGPU: boolean;
  tier: 'low' | 'medium' | 'high';
  isAutoDetected: boolean;
}

export interface DeviceOverrides {
  ram?: number;
  storage?: number;
  tier?: 'low' | 'medium' | 'high';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationSettings {
  temperature: number;
  contextLength: number;
  topP: number;
  topK: number;
  systemPrompt: string;
  nGpuLayers: number; // 0 = CPU only, 99999 = auto (all layers)
  gpuEnabled: boolean; // UI toggle, maps to nGpuLayers: 0 or 99999
  gpuAdaptive: boolean; // Try all layers, fallback down automatically
}

export type EngineState = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface EngineBackend {
  type: 'wasm' | 'wasm-multi' | 'webgpu' | 'webgpu+multi';
  threads: number;
  webgpu: boolean;
  multiThread: boolean;
  gpuLayersUsed: number;
  totalLayers: number;
  gpuFailed: boolean;
  nCtxTrain: number; // Model's actual training context length (from wllama after load)
}

export interface EngineStatus {
  state: EngineState;
  modelId: string | null;
  progress: number;
  error: string | null;
  tokensPerSecond: number;
  backend: EngineBackend | null;
  loadedContextLength: number; // Actual n_ctx used during load
}

export interface DownloadTask {
  id: string;
  modelId: string;
  fileName: string;
  repo: string;
  url: string;
  token?: string;
  progress: number;
  status: 'downloading' | 'saving' | 'done' | 'error';
  error?: string;
  totalBytes: number;
  receivedBytes: number;
  metadata?: {
    architecture: string;
    quantization: string;
    contextLength: number;
    parameterCount: string;
    name: string;
  };
}
