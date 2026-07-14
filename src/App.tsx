import { useState } from 'react';
import { AppProvider, useApp, type Tab } from './context/AppContext';
import Sidebar from './components/Sidebar/Sidebar';
import ChatView from './components/Chat/ChatView';
import ModelsView from './components/Models/ModelsView';
import SettingsPanel from './components/Settings/SettingsPanel';
import { useToast, ToastContainer } from './utils/toast';

function TabBar() {
  const { state, dispatch } = useApp();
  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'models', label: 'Models' },
  ];

  return (
    <div className="flex items-center gap-1 px-4 pt-2">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            state.tab === t.id
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
        >
          {t.label}
          {t.id === 'models' && state.downloads.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
              {state.downloads.filter(d => d.status === 'downloading' || d.status === 'saving').length || ''}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function AppContent() {
  const { state, dispatch } = useApp();
  const { toasts, removeToast } = useToast();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        />
      )}

      {/* Sidebar */}
      <div className={`${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed md:relative z-40 h-full transition-transform duration-200`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar + top controls */}
        <div className="flex items-center border-b border-zinc-800">
          {!state.sidebarOpen && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              className="ml-2 p-2 text-zinc-500 hover:text-zinc-300 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
          <TabBar />
          <div className="ml-auto mr-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab content */}
        {state.tab === 'chat' ? <ChatView /> : <ModelsView />}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
