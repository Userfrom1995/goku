import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFileSize } from '../../engine/huggingface';
import AddModelDialog from '../ModelManager/AddModelDialog';

export default function ModelsView() {
  const { state, dispatch, deleteModel, loadModelToEngine, unloadModel, cancelDownload, clearAllCache } = useApp();
  const { models, activeModelId, engine, downloads } = state;
  const [showAdd, setShowAdd] = useState(false);
  const [showClearCache, setShowClearCache] = useState(false);
  const [clearCacheInput, setClearCacheInput] = useState('');

  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'saving');

  const handleClearCache = async () => {
    if (clearCacheInput !== 'delete') return;
    await clearAllCache();
    setShowClearCache(false);
    setClearCacheInput('');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Models</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Download and manage GGUF models from HuggingFace</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearCache(true)}
              className="px-4 py-2 bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg text-sm font-medium text-zinc-400 transition-colors"
            >
              Clear Cache
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
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
                  <div
                    className="bg-violet-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: d.status === 'saving' ? '100%' : `${d.progress}%` }}
                  />
                </div>
                {d.totalBytes > 0 && (
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatFileSize(d.receivedBytes)} / {formatFileSize(d.totalBytes)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Downloaded Models */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400">
            Downloaded ({models.length})
          </h3>

          {models.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <div className="text-3xl mb-2 text-zinc-600">[ ]</div>
              <p className="text-sm">No models downloaded yet</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm text-white transition-colors"
              >
                + Add Your First Model
              </button>
            </div>
          )}

          {models.map(m => (
            <div
              key={m.id}
              className={`p-4 rounded-xl border transition-all ${
                m.id === activeModelId
                  ? 'border-violet-600/50 bg-violet-600/5 ring-1 ring-violet-600/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
                    {m.id === activeModelId && engine.state === 'ready' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 rounded-full">Active</span>
                    )}
                    {m.id === activeModelId && engine.state === 'loading' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-600/20 text-amber-400 rounded-full">Loading {engine.progress}%</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-md text-zinc-400 font-mono">{m.quantization}</span>
                    <span className="text-xs text-zinc-500">{formatFileSize(m.sizeBytes)}</span>
                    {m.totalShards && m.totalShards > 1 && (
                      <>
                        <span className="text-xs text-zinc-600">/</span>
                        <span className="text-xs text-zinc-500">{m.totalShards} shards</span>
                      </>
                    )}
                    <span className="text-xs text-zinc-600">/</span>
                    <span className="text-xs text-zinc-500">{m.architecture}</span>
                    {m.totalLayers > 0 && (
                      <>
                        <span className="text-xs text-zinc-600">·</span>
                        <span className="text-xs text-zinc-500">{m.totalLayers}L</span>
                      </>
                    )}
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">ctx {m.contextLength.toLocaleString()}</span>
                  </div>
                  {/* Context slider for non-active models */}
                  {m.id !== activeModelId && (() => {
                    const maxCtx = m.contextLength || 2048;
                    const currentCtx = Math.min(state.modelContextOverrides[m.id] || maxCtx, maxCtx);
                    return (
                      <div className="mt-2">
                        <label className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Context Length</span>
                          <span className="text-zinc-400 font-mono">{currentCtx.toLocaleString()}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={128}
                            max={maxCtx}
                            step={128}
                            value={currentCtx}
                            onChange={e => dispatch({ type: 'SET_MODEL_CONTEXT', modelId: m.id, contextLength: parseInt(e.target.value) })}
                            className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-600"
                          />
                          <input
                            type="number"
                            min={128}
                            max={maxCtx}
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
                  {/* Active model: show loaded context + warning */}
                  {m.id === activeModelId && engine.backend && (
                    <div className="mt-2">
                      {(() => {
                        const nCtxTrain = engine.backend.nCtxTrain;
                        const loadedCtx = state.engine.loadedContextLength;
                        const isOver = loadedCtx > nCtxTrain;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">ctx</span>
                            <span className={`text-xs font-mono ${isOver ? 'text-amber-400' : 'text-zinc-400'}`}>
                              {loadedCtx.toLocaleString()}
                            </span>
                            <span className="text-xs text-zinc-600">/ {nCtxTrain.toLocaleString()} max</span>
                            {isOver && (
                              <span className="text-xs text-amber-500" title={`Loaded with ${loadedCtx.toLocaleString()} but model supports ${nCtxTrain.toLocaleString()}. Quality may degrade.`}>
                                !
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Backend badges for active model */}
                  {m.id === activeModelId && engine.backend && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                        engine.backend.webgpu
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-zinc-700/50 text-zinc-500'
                      }`}>
                        {engine.backend.webgpu
                          ? (engine.backend.gpuLayersUsed >= engine.backend.totalLayers
                            ? `GPU (${engine.backend.totalLayers}/${engine.backend.totalLayers})`
                            : `GPU partial (${engine.backend.gpuLayersUsed}/${engine.backend.totalLayers})`)
                          : 'CPU'}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                        engine.backend.multiThread
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'bg-zinc-700/50 text-zinc-500'
                      }`}>
                        {engine.backend.multiThread ? `${engine.backend.threads}T` : '1T'}
                      </span>
                    </div>
                  )}
                  {/* Error display for active model */}
                  {m.id === activeModelId && engine.state === 'error' && engine.error && (
                    <div className="mt-2 p-2 bg-red-600/10 border border-red-600/20 rounded-lg">
                      <p className="text-xs text-red-400">{engine.error}</p>
                    </div>
                  )}
                  <p className="text-xs text-zinc-600 mt-1 truncate">{m.repo}/{m.file}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.id === activeModelId && (
                    <button
                      onClick={() => unloadModel()}
                      disabled={engine.state === 'generating'}
                      className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-amber-600/20 hover:text-amber-400 disabled:opacity-50 rounded-lg text-zinc-400 transition-colors"
                    >
                      Unload
                    </button>
                  )}
                  {m.id !== activeModelId && (
                    <button
                      onClick={() => loadModelToEngine(m.id)}
                      disabled={engine.state === 'loading'}
                      className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-violet-600/20 hover:text-violet-400 disabled:opacity-50 rounded-lg text-zinc-400 transition-colors"
                    >
                      Load
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${m.name}? This will free up ${formatFileSize(m.sizeBytes)} of storage.`)) {
                        deleteModel(m.id);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg text-zinc-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
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
                  {state.device.hasWebGPU ? 'Use WebGPU for faster inference' : 'WebGPU not available on this device'}
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
                  state.generation.gpuEnabled && state.device.hasWebGPU
                    ? 'bg-violet-600'
                    : 'bg-zinc-700'
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

              {/* Manual GPU Layers Slider */}
              {!state.generation.gpuAdaptive && (
                <div className="mt-3">
                  <label className="text-xs text-zinc-500 mb-1.5 block">GPU Layers</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={128}
                      step={1}
                      value={state.generation.nGpuLayers === 99999 ? 128 : Math.min(state.generation.nGpuLayers, 128)}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        dispatch({ type: 'SET_GENERATION', generation: { nGpuLayers: val === 128 ? 99999 : val }});
                      }}
                      className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-600"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99999}
                      value={state.generation.nGpuLayers === 99999 ? '' : state.generation.nGpuLayers}
                      placeholder="All"
                      onChange={e => {
                        const val = e.target.value === '' ? 99999 : parseInt(e.target.value) || 0;
                        dispatch({ type: 'SET_GENERATION', generation: { nGpuLayers: val }});
                      }}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 text-center font-mono focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                    />
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">Load model to apply changes</p>
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
                    : state.generation.gpuEnabled
                      ? 'bg-red-600/20 text-red-400 border-red-600/30'
                      : 'bg-zinc-700/50 text-zinc-400 border-zinc-700'
                }`}>
                  {engine.backend.webgpu
                    ? (engine.backend.gpuLayersUsed >= engine.backend.totalLayers
                      ? `GPU (${engine.backend.totalLayers}/${engine.backend.totalLayers})`
                      : `GPU partial (${engine.backend.gpuLayersUsed}/${engine.backend.totalLayers})`)
                    : state.generation.gpuEnabled
                      ? 'GPU Failed'
                      : 'CPU'}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${
                  engine.backend.multiThread
                    ? 'bg-blue-600/20 text-blue-400 border-blue-600/30'
                    : 'bg-zinc-700/50 text-zinc-400 border-zinc-700'
                }`}>
                  {engine.backend.multiThread ? `${engine.backend.threads} Threads` : '1 Thread'}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                {engine.backend.type === 'webgpu+multi' && 'Best: GPU acceleration + multi-threading'}
                {engine.backend.type === 'webgpu' && 'GPU only. Deploy proxy for multi-threading.'}
                {engine.backend.type === 'wasm-multi' && 'Multi-threading active. GPU disabled by user.'}
                {engine.backend.type === 'wasm' && state.generation.gpuEnabled && 'GPU failed. Using single-threaded CPU.'}
                {engine.backend.type === 'wasm' && !state.generation.gpuEnabled && 'GPU disabled. Single-threaded CPU.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddModelDialog onClose={() => setShowAdd(false)} />}

      {/* Clear Cache Modal */}
      {showClearCache && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowClearCache(false)}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">Clear All Cache</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="px-3 py-2.5 bg-red-600/10 border border-red-600/20 rounded-lg text-sm text-red-400">
                This will permanently delete:
                <ul className="mt-2 space-y-1 list-disc list-inside text-red-300/80">
                  <li>All downloaded models</li>
                  <li>All chat history</li>
                  <li>All app settings</li>
                  <li>All browser cache for this app</li>
                </ul>
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
              <button
                onClick={() => { setShowClearCache(false); setClearCacheInput(''); }}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
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
