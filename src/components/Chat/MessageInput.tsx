import { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function MessageInput() {
  const { state, sendMessage, stopGeneration } = useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = state.engine.state === 'generating';

  const handleSubmit = () => {
    if (!textareaRef.current) return;
    const trimmed = textareaRef.current.value.trim();
    if (!trimmed || isGenerating) return;
    sendMessage(trimmed);
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        placeholder={state.activeModelId ? 'Type a message...' : 'Select a model first...'}
        disabled={!state.activeModelId}
        rows={1}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 resize-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
      />
      {isGenerating ? (
        <button
          onClick={stopGeneration}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium text-white shrink-0 transition-colors"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!textareaRef.current?.value.trim() || !state.activeModelId}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-sm font-medium text-white shrink-0 transition-colors"
        >
          Send
        </button>
      )}
    </div>
  );
}
