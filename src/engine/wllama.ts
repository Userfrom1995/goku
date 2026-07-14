import { Wllama, type WllamaConfig, type AssetsPathConfig } from '@wllama/wllama';

const WASM_PATHS: AssetsPathConfig = {
  default: 'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/src/wasm/wllama.wasm',
};

export interface EngineBackend {
  type: 'wasm' | 'wasm-multi' | 'webgpu' | 'webgpu+multi';
  threads: number;
  webgpu: boolean;
  multiThread: boolean;
}

export interface WllamaEngine {
  loadModelFromBlob(blob: Blob, nCtx: number, nGpuLayers?: number): Promise<EngineBackend>;
  unloadModel(): Promise<void>;
  generate(messages: { role: string; content: string }[], opts: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    onData: (text: string) => void;
  }): Promise<void>;
  stop(): void;
  isLoaded(): boolean;
  getModelInfo(): { nCtx: number; nLayer: number; nVocab: number } | null;
}

function detectBackend(wllama: Wllama): EngineBackend {
  const webgpu = wllama.isSupportWebGPU();
  const multiThread = wllama.isMultithread();
  const threads = wllama.getNumThreads();

  if (webgpu && multiThread) return { type: 'webgpu+multi', threads, webgpu: true, multiThread: true };
  if (webgpu) return { type: 'webgpu', threads: 1, webgpu: true, multiThread: false };
  if (multiThread) return { type: 'wasm-multi', threads, webgpu: false, multiThread: true };
  return { type: 'wasm', threads: 1, webgpu: false, multiThread: false };
}

export function createWllamaEngine(): WllamaEngine {
  let wllama: Wllama | null = null;

  const config: WllamaConfig = {
    suppressNativeLog: true,
  };

  return {
    async loadModelFromBlob(blob, nCtx, nGpuLayers = 99999) {
      if (wllama) await wllama.exit();
      wllama = new Wllama(WASM_PATHS, config);

      // Try loading with requested GPU layers
      try {
        await wllama.loadModel([blob], {
          n_ctx: nCtx || 2048,
          n_gpu_layers: nGpuLayers,
        });
        return detectBackend(wllama);
      } catch (err: any) {
        // If GPU loading failed and we requested GPU layers, fallback to CPU
        if (nGpuLayers > 0) {
          console.warn('GPU loading failed, falling back to CPU:', err.message);
          if (wllama) await wllama.exit();
          wllama = new Wllama(WASM_PATHS, config);
          await wllama.loadModel([blob], {
            n_ctx: nCtx || 2048,
            n_gpu_layers: 0,
          });
          return detectBackend(wllama);
        }
        throw err;
      }
    },

    async unloadModel() {
      if (wllama) {
        await wllama.exit();
        wllama = null;
      }
    },

    async generate(messages, opts) {
      if (!wllama) throw new Error('No model loaded');

      const oaiMessages = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

      await wllama.createChatCompletion({
        messages: oaiMessages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 512,
        top_p: opts.topP ?? 0.9,
        top_k: opts.topK ?? 40,
        onData: (chunk) => {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) opts.onData(content);
        },
      });
    },

    stop() {
      wllama?.exit();
    },

    isLoaded() {
      return !!wllama?.isModelLoaded();
    },

    getModelInfo() {
      if (!wllama?.isModelLoaded()) return null;
      const meta = wllama.getModelMetadata();
      return {
        nCtx: meta.hparams.nCtxTrain,
        nLayer: meta.hparams.nLayer,
        nVocab: meta.hparams.nVocab,
      };
    },
  };
}
