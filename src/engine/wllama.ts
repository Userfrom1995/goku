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
  loadModelFromBlob(blob: Blob | Blob[], nCtx: number, nGpuLayers?: number, adaptive?: boolean): Promise<EngineBackend>;
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

async function tryLoadModel(wllama: Wllama, blob: Blob | Blob[], nCtx: number, nGpuLayers: number): Promise<{ ok: boolean; oom?: boolean }> {
  try {
    await wllama.loadModel(Array.isArray(blob) ? blob : [blob], {
      n_ctx: nCtx || 2048,
      n_gpu_layers: nGpuLayers,
    });
    return { ok: true };
  } catch (err: any) {
    const isOom = err?.message?.includes('out of memory') || err?.message?.includes('OOM') || err?.name?.includes('RangeError');
    if (isOom) return { ok: false, oom: true };
    return { ok: false };
  }
}

export function createWllamaEngine(): WllamaEngine {
  let wllama: Wllama | null = null;
  let abortController: AbortController | null = null;

  const config: WllamaConfig = {
    suppressNativeLog: true,
  };

  return {
    async loadModelFromBlob(blob, nCtx, nGpuLayers = 99999, adaptive = true) {
      if (wllama) await wllama.exit();
      wllama = new Wllama(WASM_PATHS, config);
      const blobs = Array.isArray(blob) ? blob : [blob];

      // Non-adaptive: use exactly what was requested
      if (!adaptive) {
        try {
          await wllama.loadModel(blobs, {
            n_ctx: nCtx || 2048,
            n_gpu_layers: nGpuLayers,
          });
          return detectBackend(wllama, nGpuLayers);
        } catch (err: any) {
          // If GPU failed and we requested GPU, fallback to CPU
          if (nGpuLayers > 0) {
            if (wllama) await wllama.exit();
            wllama = new Wllama(WASM_PATHS, config);
            await wllama.loadModel(blobs, {
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
      let lastOom = false;

      for (const layers of attempts) {
        if (layers > nGpuLayers) continue;

        console.log(`[Goku Adaptive] Trying ${layers} GPU layers...`);
        const result = await tryLoadModel(wllama, blobs, nCtx, layers);

        if (result.ok) {
          console.log(`[Goku Adaptive] Success with ${layers} GPU layers`);
          return detectBackend(wllama, layers);
        }

        if (result.oom) lastOom = true;

        // Reset for next attempt
        if (wllama) await wllama.exit();
        wllama = new Wllama(WASM_PATHS, config);
      }

      // All GPU attempts failed, try CPU only
      console.log('[Goku Adaptive] All GPU attempts failed, using CPU only');
      const cpuResult = await tryLoadModel(wllama, blobs, nCtx, 0);
      if (cpuResult.ok) {
        return detectBackend(wllama, 0);
      }

      const msg = lastOom
        ? `Out of memory. Try lowering context length (currently ${nCtx.toLocaleString()}).`
        : 'Failed to load model with all GPU/CPU configurations.';
      throw new Error(msg);
    },

    async unloadModel() {
      if (wllama) {
        await wllama.exit();
        wllama = null;
      }
    },

    async generate(messages, opts) {
      if (!wllama) throw new Error('No model loaded');

      abortController = new AbortController();

      const oaiMessages = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

      try {
        await wllama.createChatCompletion({
          messages: oaiMessages,
          stream: true,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 512,
          top_p: opts.topP ?? 0.9,
          top_k: opts.topK ?? 40,
          abortSignal: abortController.signal,
          onData: (chunk) => {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) opts.onData(content);
          },
        });
      } finally {
        abortController = null;
      }
    },

    stop() {
      abortController?.abort();
      abortController = null;
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
