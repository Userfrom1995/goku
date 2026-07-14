import { useApp } from '../../context/AppContext';
import ModelSelector from './ModelSelector';

export default function ModelCard() {
  const { state, deleteModel, loadModelToEngine } = useApp();
  const { models, activeModelId, engine } = state;

  if (models.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Downloaded Models</h3>
      <div className="space-y-2">
        {models.map(m => (
          <div
            key={m.id}
            className={`p-3 rounded-xl border transition-colors ${
              m.id === activeModelId
                ? 'border-violet-600/50 bg-violet-600/10'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">{m.quantization}</span>
                  <span className="text-xs text-zinc-500">{m.sizeBytes > 0 ? formatSize(m.sizeBytes) : 'size unknown'}</span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">{m.architecture} · ctx {m.contextLength}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {m.id !== activeModelId && (
                  <button
                    onClick={() => loadModelToEngine(m.id)}
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-violet-600/20 hover:text-violet-400 rounded-md text-zinc-400 transition-colors"
                  >
                    Use
                  </button>
                )}
                {m.id === activeModelId && engine.state === 'loading' && (
                  <span className="text-xs text-amber-400 px-2 py-1">Loading {engine.progress}%</span>
                )}
                {m.id === activeModelId && engine.state === 'ready' && (
                  <span className="text-xs text-emerald-400 px-2 py-1">Active</span>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Delete ${m.name}?`)) deleteModel(m.id);
                  }}
                  className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 rounded-md text-zinc-500 transition-colors"
                >
                  Del
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
