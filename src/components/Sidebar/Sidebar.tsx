import { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { importSession as readImportFile } from '../../utils/export';

export default function Sidebar() {
  const { state, createNewSession, deleteSession, exportSession, importSession, dispatch } = useApp();
  const { sessions, activeSessionId } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await readImportFile(file);
      await importSession(json);
    } catch (err: any) {
      alert('Failed to import: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <aside className={`${state.sidebarOpen ? 'w-72' : 'w-0'} bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-200 overflow-hidden shrink-0`}>
      <div className="p-4 border-b border-zinc-800 min-w-[288px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Goku</h1>
            <p className="text-xs text-zinc-600">Client-side LLM Inference</p>
          </div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3 min-w-[288px]">
        <button
          onClick={createNewSession}
          className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 min-w-[288px]">
        {sessions.length === 0 && (
          <p className="text-xs text-zinc-700 px-2 py-6 text-center">No chat history yet</p>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => {
              dispatch({ type: 'SET_ACTIVE_SESSION', id: s.id });
              dispatch({ type: 'SET_TAB', tab: 'chat' });
            }}
            className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
              s.id === activeSessionId
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
            }`}
          >
            <p className="text-sm truncate">{s.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-zinc-700">{s.messages.length} msgs</p>
              <span className="text-xs text-zinc-800">·</span>
              <p className="text-xs text-zinc-700">{timeAgo(s.updatedAt)}</p>
            </div>
            <div className="hidden group-hover:flex gap-2 mt-1.5">
              <button
                onClick={e => { e.stopPropagation(); exportSession(s.id); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Export
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (confirm('Delete this chat?')) deleteSession(s.id);
                }}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800 min-w-[288px] space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Import Chat
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'models' })}
          className="w-full px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Manage Models
        </button>
      </div>
    </aside>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
