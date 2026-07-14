import { useApp } from '../../context/AppContext';
import { formatFileSize } from '../../engine/huggingface';

export default function ModelSelector() {
  const { state, loadModelToEngine } = useApp();
  const { models, activeModelId, engine } = state;

  return (
    <select
      value={activeModelId || ''}
      onChange={e => { if (e.target.value) loadModelToEngine(e.target.value); }}
      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 max-w-[240px] truncate focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
    >
      <option value="">Select model...</option>
      {models.map(m => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.quantization}) - {formatFileSize(m.sizeBytes)}
        </option>
      ))}
    </select>
  );
}
