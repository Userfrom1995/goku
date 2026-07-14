import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFileSize } from '../../engine/huggingface';
import AddModelDialog from '../ModelManager/AddModelDialog';

export default function ModelsView() {
  const { state, deleteModel, loadModelToEngine } = useApp();
  const { models, activeModelId, engine, downloads } = state;
  const [showAdd, setShowAdd] = useState(false);

  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'saving');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Models</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Download and manage GGUF models from HuggingFace</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            + Add Model
          </button>
        </div>

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400">Downloading ({activeDownloads.length})</h3>
            {activeDownloads.map(d => (
              <div key={d.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300 truncate max-w-[70%]">{d.fileName}</span>
                  <span className="text-xs text-zinc-500">
                    {d.status === 'saving' ? 'Saving...' : `${d.progress}%`}
                  </span>
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
              <div className="text-3xl mb-2">📦</div>
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
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">{m.architecture}</span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">ctx {m.contextLength.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 truncate">{m.repo}/{m.file}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
          {engine.backend && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">Active Backend</p>
              <p className="text-sm text-zinc-300">
                {engine.backend.type === 'webgpu' && 'WebGPU (GPU-accelerated)'}
                {engine.backend.type === 'wasm-multi' && `WASM Multi-thread (${engine.backend.threads} threads)`}
                {engine.backend.type === 'wasm' && 'WASM Single-thread'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddModelDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}
