import { useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GenerationSettings from './GenerationSettings';
import ModelSelector from '../ModelManager/ModelSelector';

function BackendBadge() {
  const { state } = useApp();
  const { engine } = state;

  if (engine.state === 'idle' || engine.state === 'error') return null;

  const backend = engine.backend;
  if (!backend) return null;

  const config: Record<string, { label: string; color: string; tip: string }> = {
    'webgpu+multi': { label: `GPU + ${backend.threads} threads`, color: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30', tip: 'WebGPU compute + multi-threaded WASM' },
    'webgpu':       { label: 'GPU', color: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30', tip: 'WebGPU compute (single-threaded). Deploy proxy for multi-threading.' },
    'wasm-multi':   { label: `${backend.threads} threads`, color: 'bg-blue-600/20 text-blue-400 border-blue-600/30', tip: 'Multi-threaded WASM' },
    'wasm':         { label: 'WASM', color: 'bg-zinc-700/50 text-zinc-400 border-zinc-700', tip: 'Single-threaded WASM. Deploy proxy for multi-threading.' },
  };

  const c = config[backend.type] || config.wasm;

  return (
    <span className={`px-2 py-0.5 text-xs font-mono rounded-md border ${c.color}`} title={c.tip}>
      {c.label}
    </span>
  );
}

export default function ChatView() {
  const { state, dispatch } = useApp();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId);
  const messages = activeSession?.messages || [];

  // Use the actual context the model was loaded with
  const contextLength = state.engine.loadedContextLength || 2048;

  const estimatedTokens = useMemo(() => {
    const allText = messages.map(m => m.content).join('');
    const systemText = state.generation.systemPrompt || '';
    return Math.ceil((allText.length + systemText.length) / 4);
  }, [messages, state.generation.systemPrompt]);

  const contextPercent = Math.min(100, Math.round((estimatedTokens / contextLength) * 100));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Model selector bar */}
      <div className="border-b border-zinc-800 px-4 py-2 flex items-center gap-3">
        <ModelSelector />
        <BackendBadge />
        <div className="ml-auto flex items-center gap-3">
          {state.engine.state === 'loading' && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600 rounded-full animate-pulse" style={{ width: `${state.engine.progress}%` }} />
              </div>
              <span className="text-xs text-zinc-500">Loading {state.engine.progress}%</span>
            </div>
          )}
          {state.engine.state === 'generating' && (
            <span className="text-xs text-violet-400 animate-pulse">Generating...</span>
          )}
          {state.engine.state === 'ready' && state.activeModelId && (
            <div className="flex items-center gap-2" title={`${estimatedTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (~${contextPercent}%)`}>
              <span className="text-xs text-zinc-500">ctx</span>
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${contextPercent > 90 ? 'bg-red-500' : contextPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${contextPercent}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">{contextPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            {state.models.length === 0 ? (
              <div className="text-center space-y-3">
                <div className="text-4xl mb-2">⚡</div>
                <p className="text-xl font-medium text-zinc-300">Welcome to Goku</p>
                <p className="text-sm max-w-sm">Download a model from HuggingFace to start chatting. Everything runs in your browser.</p>
                <button
                  onClick={() => dispatch({ type: 'SET_TAB', tab: 'models' })}
                  className="mt-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  Add Your First Model
                </button>
              </div>
            ) : !state.activeModelId ? (
              <div className="text-center space-y-3">
                <div className="text-4xl mb-2">🔌</div>
                <p className="text-xl font-medium text-zinc-300">Select a model</p>
                <p className="text-sm">Choose a model from the dropdown above to start chatting</p>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-xl font-medium text-zinc-300">Start chatting</p>
                <p className="text-sm">Type a message below to begin</p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-end gap-3">
          <div className="flex-1">
            <MessageInput />
          </div>
          <GenerationSettings />
        </div>
      </div>
    </div>
  );
}
