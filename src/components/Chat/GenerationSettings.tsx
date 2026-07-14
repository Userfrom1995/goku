import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function GenerationSettings() {
  const { state, dispatch } = useApp();
  const { generation } = state;
  const [open, setOpen] = useState(false);

  const update = (patch: Partial<typeof generation>) => {
    dispatch({ type: 'SET_GENERATION', generation: patch });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
        title="Generation Settings"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl z-50">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Generation Settings</h3>

            <div className="space-y-4">
              <SliderField
                label="Temperature"
                value={generation.temperature}
                min={0} max={2} step={0.1}
                onChange={v => update({ temperature: v })}
              />
              <SliderField
                label="Top P"
                value={generation.topP}
                min={0} max={1} step={0.05}
                onChange={v => update({ topP: v })}
              />
              <SliderField
                label="Top K"
                value={generation.topK}
                min={1} max={100} step={1}
                onChange={v => update({ topK: v })}
              />

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">System Prompt</label>
                <textarea
                  value={generation.systemPrompt}
                  onChange={e => update({ systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                />
              </div>
            </div>

            <button onClick={() => setOpen(false)} className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Close</button>
          </div>
        </>
      )}
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <label className="flex justify-between text-xs text-zinc-500 mb-1.5">
        <span>{label}</span>
        <span className="text-zinc-400 font-mono">{format ? format(value) : value}</span>
      </label>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-600"
      />
    </div>
  );
}
