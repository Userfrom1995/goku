import { AppProvider, useApp, type Tab } from './context/AppContext';
import Sidebar from './components/Sidebar/Sidebar';
import ChatView from './components/Chat/ChatView';
import ModelsView from './components/Models/ModelsView';
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
              ☰
            </button>
          )}
          <TabBar />
        </div>

        {/* Tab content */}
        {state.tab === 'chat' ? <ChatView /> : <ModelsView />}
      </div>

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
