import { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFileSize, getDownloadUrl, getFileSizeFromUrl, parseHuggingFaceUrl, listGgufFiles, type HuggingFaceFile } from '../../engine/huggingface';
import { MODEL_CATALOG, type CatalogModel } from '../../engine/modelCatalog';
import { readGgufMetadata } from '../../engine/gguf';
import { getWllamaCacheStore } from '../../storage/wllamaCache';
import * as db from '../../storage/db';
import { checkModelFit } from '../../utils/resourceCheck';
import type { ModelMetadata, DownloadTask } from '../../types';

type ModelEntry = {
  id: string;
  name: string;
  repo: string;
  file: string;
  sizeBytes: number;
  quantization: string;
  architecture: string;
  contextLength: number;
  totalLayers: number;
  status: 'loaded' | 'ready' | 'downloading' | 'not_downloaded';
  downloadProgress?: number;
  isSharded?: boolean;
  totalShards?: number;
  isCustom: boolean;
  catalogModel?: CatalogModel;
};

function ModelCard({ m, state, engine, blockModelBtn, onLoad, onDelete, onCancel, onUnload, dispatch, modelContextOverrides }: {
  m: ModelEntry;
  state: any;
  engine: any;
  blockModelBtn: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string, name: string, sizeBytes: number) => void;
  onCancel: (id: string) => void;
  onUnload: () => void;
  dispatch: any;
  modelContextOverrides: Record<string, number>;
}) {
  const isActive = m.id === state.activeModelId;
  const fit = checkModelFit(m.sizeBytes, state.device);

  // State: LOADED
  if (m.status === 'loaded') {
    return (
      <div className="p-4 rounded-xl border-2 border-violet-600/50 bg-violet-600/5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 rounded-full">Loaded</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">HF repo: {m.repo}</p>
            <p className="text-xs text-zinc-500">Size: {formatFileSize(m.sizeBytes)}</p>
            {engine.backend && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                  engine.backend.webgpu ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'
                }`}>
                  {engine.backend.webgpu
                    ? (engine.backend.gpuLayersUsed >= engine.backend.totalLayers
                      ? `GPU (${engine.backend.totalLayers}/${engine.backend.totalLayers})`
                      : `GPU partial (${engine.backend.gpuLayersUsed}/${engine.backend.totalLayers})`)
                    : 'CPU'}
                </span>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                  engine.backend.multiThread ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-700/50 text-zinc-500'
                }`}>
                  {engine.backend.multiThread ? `${engine.backend.threads}T` : '1T'}
                </span>
                {engine.backend.nCtxTrain > 0 && (
                  <span className="text-xs text-zinc-600">
                    ctx {state.engine.loadedContextLength.toLocaleString()} / {engine.backend.nCtxTrain.toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {engine.state === 'error' && engine.error && (
              <div className="mt-2 p-2 bg-red-600/10 border border-red-600/20 rounded-lg">
                <p className="text-xs text-red-400">{engine.error}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onUnload()}
              disabled={engine.state === 'generating'}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-amber-600/20 hover:text-amber-400 disabled:opacity-50 rounded-lg text-zinc-400 transition-colors"
            >
              Unload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State: LOADING
  if (m.status === 'downloading' && isActive) {
    return (
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
          <span className="text-xs text-zinc-500">Loading {engine.progress}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div className="bg-violet-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${engine.progress}%` }} />
        </div>
      </div>
    );
  }

  // State: READY
  if (m.status === 'ready') {
    return (
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
            <p className="text-xs text-zinc-500 mt-1">HF repo: {m.repo}</p>
            <p className="text-xs text-zinc-500">Size: {formatFileSize(m.sizeBytes)}</p>
            {(() => {
              const maxCtx = m.contextLength || 2048;
              const currentCtx = Math.min(modelContextOverrides[m.id] || maxCtx, maxCtx);
              return (
                <div className="mt-2">
                  <label className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>Context Length</span>
                    <span className="text-zinc-400 font-mono">{currentCtx.toLocaleString()}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={128} max={maxCtx} step={128}
                      value={currentCtx}
                      onChange={e => dispatch({ type: 'SET_MODEL_CONTEXT', modelId: m.id, contextLength: parseInt(e.target.value) })}
                      className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-600"
                    />
                    <input
                      type="number" min={128} max={maxCtx}
                      value={currentCtx}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        if (!isNaN(v) && v >= 128 && v <= maxCtx) {
                          dispatch({ type: 'SET_MODEL_CONTEXT', modelId: m.id, contextLength: v });
                        }
                      }}
                      className="w-20 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 font-mono text-right focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onLoad(m.id)}
              disabled={blockModelBtn}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-violet-600/20 hover:text-violet-400 disabled:opacity-50 rounded-lg text-zinc-400 transition-colors"
            >
              Load
            </button>
            <button
              onClick={() => onDelete(m.id, m.name, m.sizeBytes)}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg text-zinc-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State: DOWNLOADING
  if (m.status === 'downloading') {
    const dlTask = state.downloads.find((d: any) => d.fileName === m.file);
    return (
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{dlTask?.progress ?? 0}%</span>
            <button
              onClick={() => onCancel(dlTask!.id)}
              className="px-2 py-1 text-xs font-medium bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded text-zinc-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div className="bg-violet-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${dlTask?.progress ?? 0}%` }} />
        </div>
        {dlTask && dlTask.totalBytes > 0 && (
          <p className="text-xs text-zinc-600 mt-1">
            {formatFileSize(dlTask.receivedBytes)} / {formatFileSize(dlTask.totalBytes)}
          </p>
        )}
      </div>
    );
  }

  // State: NOT DOWNLOADED
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
          <p className="text-xs text-zinc-500 mt-1">HF repo: {m.repo}</p>
          <p className="text-xs text-zinc-500">Size: {formatFileSize(m.sizeBytes)}</p>
          {!fit.fits && (
            <p className="text-xs text-amber-500/70 mt-1">{fit.message}</p>
          )}
        </div>
        <div className="shrink-0">
          <button
            onClick={() => onLoad(m.id)}
            disabled={blockModelBtn || !fit.fits}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-violet-600/20 hover:text-violet-400 disabled:opacity-50 rounded-lg text-zinc-400 transition-colors"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModelsView() {
  const { state, dispatch, deleteModel, loadModelToEngine, unloadModel, cancelDownload, clearAllCache } = useApp();
  const { models, activeModelId, engine, downloads } = state;
  const [showAdd, setShowAdd] = useState(false);
  const [showClearCache, setShowClearCache] = useState(false);
  const [clearCacheInput, setClearCacheInput] = useState('');

  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'saving');
  const blockModelBtn = engine.state === 'loading' || engine.state === 'generating' || activeDownloads.length > 0;

  const handleClearCache = async () => {
    if (clearCacheInput !== 'delete') return;
    await clearAllCache();
    setShowClearCache(false);
    setClearCacheInput('');
  };

  const startDownload = async (repo: string, file: string, displayName: string, sizeHint?: number) => {
    const modelId = `${repo}/${file}`.replace(/[^a-zA-Z0-9]/g, '_');
    if (state.models.some(m => m.id === modelId)) return;
    if (state.downloads.some(d => d.fileName === file)) return;

    const downloadUrl = getDownloadUrl(repo, file);
    const [meta, size] = await Promise.all([
      readGgufMetadata(downloadUrl),
      getFileSizeFromUrl(downloadUrl),
    ]);

    const task: DownloadTask = {
      id: crypto.randomUUID(),
      modelId,
      fileName: file,
      repo,
      url: downloadUrl,
      progress: 0,
      status: 'downloading',
      totalBytes: size || sizeHint || 0,
      receivedBytes: 0,
      metadata: {
        architecture: meta.architecture,
        quantization: meta.quantization,
        contextLength: meta.contextLength,
        parameterCount: meta.parameterCount,
        name: meta.name || displayName,
      },
      files: [downloadUrl],
      totalShards: 1,
    };

    dispatch({ type: 'ADD_DOWNLOAD', task });

    const abortController = new AbortController();
    (window as any).__gokuAbortControllers = (window as any).__gokuAbortControllers || {};
    (window as any).__gokuAbortControllers[task.id] = abortController;

    (async () => {
      try {
        const cache = await getWllamaCacheStore();
        await cache.download(downloadUrl, {
          signal: abortController.signal,
          progressCallback: ({ loaded, total }) => {
            if (total > 0) {
              dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: {
                progress: Math.round((loaded / total) * 100),
                receivedBytes: loaded,
                totalBytes: total,
              }});
            }
          },
        });

        const modelRecord: ModelMetadata = {
          id: modelId,
          name: meta.name || displayName,
          repo,
          file,
          url: downloadUrl,
          sizeBytes: size || sizeHint || 0,
          quantization: meta.quantization,
          architecture: meta.architecture,
          contextLength: meta.contextLength,
          totalLayers: meta.totalLayers,
          parameterCount: meta.parameterCount,
          downloadedAt: Date.now(),
          storageKey: downloadUrl,
          files: [downloadUrl],
          totalShards: 1,
        };

        await db.saveModel(modelRecord);
        dispatch({ type: 'ADD_MODEL', model: modelRecord });
        dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: { status: 'done', progress: 100 } });
        setTimeout(() => dispatch({ type: 'REMOVE_DOWNLOAD', id: task.id }), 3000);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('abort')) {
          dispatch({ type: 'REMOVE_DOWNLOAD', id: task.id });
          return;
        }
        dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: { status: 'error', error: err.message } });
      }
    })();
  };

  const handleCatalogDownload = (cm: CatalogModel) => {
    startDownload(cm.repo, cm.file, cm.name, cm.sizeBytes);
  };

  const handleCustomDownload = (m: ModelEntry) => {
    startDownload(m.repo, m.file, m.name, m.sizeBytes);
  };

  // Build model entries
  const customModels: ModelEntry[] = [];
  const recommendedModels: ModelEntry[] = [];

  // Downloaded models -> custom (they came from user adding a URL)
  for (const m of models) {
    const isActive = m.id === activeModelId;
    const isLoadingThis = isActive && engine.state === 'loading';
    const isLoadedThis = isActive && engine.state === 'ready';
    const isCatalog = MODEL_CATALOG.some(cm => `${cm.repo}/${cm.file}`.replace(/[^a-zA-Z0-9]/g, '_') === m.id);
    const entry: ModelEntry = {
      id: m.id,
      name: m.name,
      repo: m.repo,
      file: m.file,
      sizeBytes: m.sizeBytes,
      quantization: m.quantization,
      architecture: m.architecture,
      contextLength: m.contextLength,
      totalLayers: m.totalLayers,
      status: isLoadedThis ? 'loaded' : isLoadingThis ? 'downloading' : 'ready',
      downloadProgress: isLoadingThis ? engine.progress : undefined,
      isSharded: (m.totalShards ?? 1) > 1,
      totalShards: m.totalShards,
      isCustom: !isCatalog,
    };
    if (isCatalog) {
      recommendedModels.push(entry);
    } else {
      customModels.push(entry);
    }
  }

  // Catalog models (not yet downloaded)
  for (const cm of MODEL_CATALOG) {
    const id = `${cm.repo}/${cm.file}`.replace(/[^a-zA-Z0-9]/g, '_');
    if (recommendedModels.some(m => m.id === id)) continue;
    const dlTask = state.downloads.find(d => d.fileName === cm.file);
    recommendedModels.push({
      id,
      name: cm.name,
      repo: cm.repo,
      file: cm.file,
      sizeBytes: cm.sizeBytes,
      quantization: cm.quantization,
      architecture: cm.architecture,
      contextLength: cm.contextLength,
      totalLayers: 0,
      status: dlTask ? 'downloading' : 'not_downloaded',
      downloadProgress: dlTask?.progress,
      isCustom: false,
      catalogModel: cm,
    });
  }

  const handleLoad = (id: string) => loadModelToEngine(id);
  const handleDelete = (id: string, name: string, sizeBytes: number) => {
    if (confirm(`Delete ${name}? This will free up ${formatFileSize(sizeBytes)} of storage.`)) {
      deleteModel(id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Models</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Download and manage GGUF models</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearCache(true)}
              className="px-3 py-2 bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg text-sm font-medium text-zinc-400 transition-colors"
            >
              Clear Cache
            </button>
            <button
              onClick={() => setShowAdd(true)}
              disabled={blockModelBtn}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium text-white transition-colors"
            >
              + Add Model
            </button>
          </div>
        </div>

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400">Downloading ({activeDownloads.length})</h3>
            {activeDownloads.map(d => (
              <div key={d.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300 truncate max-w-[60%]">{d.fileName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {d.status === 'saving' ? 'Saving...' : `${d.progress}%`}
                    </span>
                    <button
                      onClick={() => cancelDownload(d.id)}
                      className="px-2 py-1 text-xs font-medium bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded text-zinc-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div className="bg-violet-600 h-1.5 rounded-full transition-all duration-300" style={{ width: d.status === 'saving' ? '100%' : `${d.progress}%` }} />
                </div>
                {d.totalBytes > 0 && (
                  <p className="text-xs text-zinc-600 mt-1">{formatFileSize(d.receivedBytes)} / {formatFileSize(d.totalBytes)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Custom Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400">Custom models</h3>
            <button
              onClick={() => setShowAdd(true)}
              disabled={blockModelBtn}
              className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-white transition-colors"
            >
              + Add GGUF
            </button>
          </div>
          {customModels.length === 0 && (
            <p className="text-xs text-zinc-600">No custom models added yet.</p>
          )}
          {customModels.map(m => (
            <ModelCard
              key={m.id}
              m={m}
              state={state}
              engine={engine}
              blockModelBtn={blockModelBtn}
              onLoad={handleLoad}
              onDelete={handleDelete}
              onCancel={cancelDownload}
              onUnload={unloadModel}
              dispatch={dispatch}
              modelContextOverrides={state.modelContextOverrides}
            />
          ))}
        </div>

        {/* Recommended Models */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400">Recommended models</h3>
          {recommendedModels.map(m => (
            <ModelCard
              key={m.id}
              m={m}
              state={state}
              engine={engine}
              blockModelBtn={blockModelBtn}
              onLoad={m.status === 'not_downloaded' ? () => handleCatalogDownload(m.catalogModel!) : handleLoad}
              onDelete={handleDelete}
              onCancel={cancelDownload}
              onUnload={unloadModel}
              dispatch={dispatch}
              modelContextOverrides={state.modelContextOverrides}
            />
          ))}
        </div>

        {/* Device Info */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
          <h3 className="text-sm font-semibold text-zinc-400">Device</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-zinc-600">RAM</p>
              <p className="text-sm text-zinc-300">{state.device.ram} GB</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Storage</p>
              <p className="text-sm text-zinc-300">{state.device.storage} GB</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Tier</p>
              <p className="text-sm text-zinc-300 capitalize">{state.device.tier}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">WebGPU</p>
              <p className={`text-sm ${state.device.hasWebGPU ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {state.device.hasWebGPU ? 'Available' : 'Not available'}
              </p>
            </div>
          </div>

          {/* GPU Toggle */}
          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300">GPU Acceleration</p>
                <p className="text-xs text-zinc-600">
                  {state.device.hasWebGPU ? 'Use WebGPU for faster inference' : 'WebGPU not available'}
                </p>
              </div>
              <button
                onClick={() => {
                  const newGpuEnabled = !state.generation.gpuEnabled;
                  dispatch({ type: 'SET_GENERATION', generation: {
                    gpuEnabled: newGpuEnabled,
                    gpuAdaptive: newGpuEnabled,
                    nGpuLayers: newGpuEnabled ? 99999 : 0,
                  }});
                }}
                disabled={!state.device.hasWebGPU}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  state.generation.gpuEnabled && state.device.hasWebGPU ? 'bg-violet-600' : 'bg-zinc-700'
                } ${!state.device.hasWebGPU ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  state.generation.gpuEnabled && state.device.hasWebGPU ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Adaptive Offloading */}
          {state.generation.gpuEnabled && state.device.hasWebGPU && (
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">Adaptive Offloading</p>
                  <p className="text-xs text-zinc-600">Auto-detect best GPU layers</p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_GENERATION', generation: { gpuAdaptive: !state.generation.gpuAdaptive } })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    state.generation.gpuAdaptive ? 'bg-violet-600' : 'bg-zinc-700'
                  } cursor-pointer`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    state.generation.gpuAdaptive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {!state.generation.gpuAdaptive && (
                <div className="mt-3">
                  <label className="text-xs text-zinc-500 mb-1.5 block">GPU Layers</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={0} max={128} step={1}
                      value={state.generation.nGpuLayers === 99999 ? 128 : Math.min(state.generation.nGpuLayers, 128)}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        dispatch({ type: 'SET_GENERATION', generation: { nGpuLayers: val === 128 ? 99999 : val }});
                      }}
                      className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-600"
                    />
                    <input
                      type="number" min={0} max={99999}
                      value={state.generation.nGpuLayers === 99999 ? '' : state.generation.nGpuLayers}
                      placeholder="All"
                      onChange={e => {
                        const val = e.target.value === '' ? 99999 : parseInt(e.target.value) || 0;
                        dispatch({ type: 'SET_GENERATION', generation: { nGpuLayers: val }});
                      }}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 text-center font-mono focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Backend */}
          {engine.backend && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 mb-1.5">Active Backend</p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${
                  engine.backend.webgpu
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                    : state.generation.gpuEnabled ? 'bg-red-600/20 text-red-400 border-red-600/30' : 'bg-zinc-700/50 text-zinc-400 border-zinc-700'
                }`}>
                  {engine.backend.webgpu
                    ? (engine.backend.gpuLayersUsed >= engine.backend.totalLayers
                      ? `GPU (${engine.backend.totalLayers}/${engine.backend.totalLayers})`
                      : `GPU partial (${engine.backend.gpuLayersUsed}/${engine.backend.totalLayers})`)
                    : state.generation.gpuEnabled ? 'GPU Failed' : 'CPU'}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${
                  engine.backend.multiThread ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' : 'bg-zinc-700/50 text-zinc-400 border-zinc-700'
                }`}>
                  {engine.backend.multiThread ? `${engine.backend.threads} Threads` : '1 Thread'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Model Dialog */}
      {showAdd && <AddModelDialogInline onClose={() => setShowAdd(false)} onDownload={startDownload} blockModelBtn={blockModelBtn} />}

      {/* Clear Cache Modal */}
      {showClearCache && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowClearCache(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">Clear All Cache</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="px-3 py-2.5 bg-red-600/10 border border-red-600/20 rounded-lg text-sm text-red-400">
                This will permanently delete all downloaded models, chat history, and settings.
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">
                  Type <span className="font-mono text-red-400">delete</span> to confirm
                </label>
                <input
                  value={clearCacheInput}
                  onChange={e => setClearCacheInput(e.target.value)}
                  placeholder="delete"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button onClick={() => { setShowClearCache(false); setClearCacheInput(''); }} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
              <button
                onClick={handleClearCache}
                disabled={clearCacheInput !== 'delete'}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white transition-colors"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddModelDialogInline({ onClose, onDownload, blockModelBtn }: {
  onClose: () => void;
  onDownload: (repo: string, file: string, displayName: string, sizeHint?: number) => Promise<void>;
  blockModelBtn: boolean;
}) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<HuggingFaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setFiles([]);
    setSelectedFile('');
    try {
      const parsed = parseHuggingFaceUrl(url);
      if (parsed.file) {
        onDownload(parsed.repo, parsed.file, parsed.file, undefined);
        onClose();
        return;
      }
      const ggufFiles = await listGgufFiles(parsed.repo, token || undefined);
      if (ggufFiles.length === 0) {
        setError('No GGUF files found in this repository');
        setLoading(false);
        return;
      }
      setFiles(ggufFiles);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [url, token, onDownload, onClose]);

  const handleAdd = () => {
    if (!selectedFile || !url.trim()) return;
    const parsed = parseHuggingFaceUrl(url);
    onDownload(parsed.repo, selectedFile, selectedFile, undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Add GGUF Model</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">x</button>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">Enter a HuggingFace repo URL</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">HuggingFace repo</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="e.g. TheBloke/Llama-2-7B-Chat-GGUF"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
              autoFocus
            />
          </div>
          {files.length > 0 && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Select model file</label>
              <select
                value={selectedFile}
                onChange={e => setSelectedFile(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
              >
                <option value="">-- Select --</option>
                {files.map(f => (
                  <option key={f.path} value={f.path}>{f.path} {f.size > 0 ? `(${formatFileSize(f.size)})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">HF Token <span className="text-zinc-600">(optional)</span></label>
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              type="password"
              placeholder="hf_..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
            />
          </div>
          {error && (
            <div className="px-3 py-2 bg-red-600/10 border border-red-600/20 rounded-lg text-sm text-red-400">{error}</div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-300 transition-colors">Cancel</button>
            {files.length > 0 ? (
              <button
                onClick={handleAdd}
                disabled={!selectedFile}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Download
              </button>
            ) : (
              <button
                onClick={handleFetch}
                disabled={!url.trim() || loading}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {loading ? 'Fetching...' : 'Fetch'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
