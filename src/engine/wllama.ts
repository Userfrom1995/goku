import { Wllama, type WllamaConfig, type AssetsPathConfig } from '@wllama/wllama';

const WASM_PATHS: AssetsPathConfig = {
  default: '/goku/wasm/wllama.wasm',
};

export interface EngineBackend {
  type: 'wasm' | 'wasm-multi' | 'webgpu' | 'webgpu+multi';
  threads: number;
  webgpu: boolean;
  multiThread: boolean;
  gpuLayersUsed: number;
  totalLayers: number;
  gpuFailed: boolean;
  nCtxTrain: number;
}

export interface WllamaEngine {
  loadModelFromBlob(blob: Blob, nCtx: number, nGpuLayers?: number, adaptive?: boolean): Promise<EngineBackend>;
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

function detectBackend(wllama: Wllama, actualNGpuLayers: number, gpuFailed: boolean = false): EngineBackend {
  const hasWebGPU = !!(navigator as any).gpu;
  const multiThread = wllama.isMultithread();
  const threads = wllama.getNumThreads();
  const webgpu = hasWebGPU && actualNGpuLayers > 0;
  const meta = wllama.getModelMetadata();
  const totalLayers = meta?.hparams?.nLayer || 0;
  const nCtxTrain = meta?.hparams?.nCtxTrain || 2048;

  if (webgpu && multiThread) return { type: 'webgpu+multi', threads, webgpu: true, multiThread: true, gpuLayersUsed: actualNGpuLayers, totalLayers, gpuFailed, nCtxTrain };
  if (webgpu) return { type: 'webgpu', threads: 1, webgpu: true, multiThread: false, gpuLayersUsed: actualNGpuLayers, totalLayers, gpuFailed, nCtxTrain };
  if (multiThread) return { type: 'wasm-multi', threads, webgpu: false, multiThread: true, gpuLayersUsed: 0, totalLayers, gpuFailed, nCtxTrain };
  return { type: 'wasm', threads: 1, webgpu: false, multiThread: false, gpuLayersUsed: 0, totalLayers, gpuFailed, nCtxTrain };
}

async function tryLoadModel(wllama: Wllama, blob: Blob, nCtx: number, nGpuLayers: number): Promise<boolean> {
  try {
    await wllama.loadModel([blob], {
      n_ctx: nCtx || 2048,
      n_gpu_layers: nGpuLayers,
    });
    return true;
  } catch {
    return false;
  }
}

export function createWllamaEngine(): WllamaEngine {
  let wllama: Wllama | null = null;

  const config: WllamaConfig = {
    suppressNativeLog: true,
  };

  return {
    async loadModelFromBlob(blob, nCtx, nGpuLayers = 99999, adaptive = true) {
      if (wllama) await wllama.exit();
      wllama = new Wllama(WASM_PATHS, config);

      // Non-adaptive: use exactly what was requested
      if (!adaptive) {
        try {
          await wllama.loadModel([blob], {
            n_ctx: nCtx || 2048,
            n_gpu_layers: nGpuLayers,
          });
          return detectBackend(wllama, nGpuLayers);
        } catch (err: any) {
          // If GPU failed and we requested GPU, fallback to CPU
          if (nGpuLayers > 0) {
            if (wllama) await wllama.exit();
            wllama = new Wllama(WASM_PATHS, config);
            await wllama.loadModel([blob], {
              n_ctx: nCtx || 2048,
              n_gpu_layers: 0,
            });
            return detectBackend(wllama, 0, true);
          }
          throw err;
        }
      }

      // Adaptive: try different layer counts
      const attempts = [99999, 64, 32, 16, 8, 4, 2, 1, 0];

      for (const layers of attempts) {
        if (layers > nGpuLayers) continue;

        console.log(`[Goku Adaptive] Trying ${layers} GPU layers...`);
        const success = await tryLoadModel(wllama, blob, nCtx, layers);

        if (success) {
          console.log(`[Goku Adaptive] Success with ${layers} GPU layers`);
          return detectBackend(wllama, layers);
        }

        // Reset for next attempt
        if (wllama) await wllama.exit();
        wllama = new Wllama(WASM_PATHS, config);
      }

      // All GPU attempts failed, try CPU only
      console.log('[Goku Adaptive] All GPU attempts failed, using CPU only');
      await wllama.loadModel([blob], {
        n_ctx: nCtx || 2048,
        n_gpu_layers: 0,
      });
      return detectBackend(wllama, 0);
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
