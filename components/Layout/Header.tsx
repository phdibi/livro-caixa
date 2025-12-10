import React, { useState } from 'react';
import {
  PlusIcon,
  RefreshIcon,
  DownloadIcon,
  ChartBarIcon,
  ListIcon,
  CalendarIcon,
} from '../../Icons';
import { shortcutsList } from '../../useKeyboardShortcuts';

interface HeaderProps {
  onSignOut: () => void;
  onOpenBackup: () => void;
  onForceSync: () => void;
  isSyncing: boolean;
  isBackgroundSyncing?: boolean;
  onExport: () => void;
  activeView: 'dashboard' | 'cashflow' | 'irpf' | 'list';
  setActiveView: (view: 'dashboard' | 'cashflow' | 'irpf' | 'list') => void;
  onOpenRecurring: () => void;
  onAddTransaction: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSignOut,
  onOpenBackup,
  onForceSync,
  isSyncing,
  isBackgroundSyncing = false,
  onExport,
  activeView,
  setActiveView,
  onOpenRecurring,
  onAddTransaction,
}) => {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
        <div className="flex w-full sm:w-auto justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
            Livro Caixa
          </h1>
          <div className="sm:hidden flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="text-xs text-gray-500 dark:text-gray-400"
              title="Atalhos"
            >
              ⌨️
            </button>
            <button
              onClick={onSignOut}
              className="text-xs text-gray-500 hover:text-red-500"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="flex items-center w-full sm:w-auto justify-around sm:justify-end sm:space-x-2">
          <button
            onClick={onSignOut}
            className="hidden sm:block text-xs text-gray-500 hover:text-red-500 mr-2"
          >
            Sair
          </button>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="hidden sm:block p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Atalhos (?)"
          >
            <span className="text-sm">⌨️</span>
          </button>
          <button
            onClick={onOpenBackup}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Backup/Restaurar"
          >
            💾
          </button>
          <button
            onClick={onForceSync}
            disabled={isSyncing}
            className={`p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 ${isSyncing ? 'animate-spin' : ''
              }`}
            title="Sincronizar (Ctrl+S)"
          >
            <RefreshIcon className={`w-6 h-6 ${isBackgroundSyncing ? 'animate-spin text-green-500' : ''}`} />
          </button>
          <button
            onClick={onExport}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Exportar (Ctrl+E)"
          >
            <DownloadIcon className="w-6 h-6" />
          </button>

          {/* Navegação */}
          {(['dashboard', 'cashflow', 'irpf', 'list'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`p-2 rounded-md ${activeView === view
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              title={
                view === 'dashboard'
                  ? 'Dashboard'
                  : view === 'cashflow'
                    ? 'Fluxo de Caixa'
                    : view === 'irpf'
                      ? 'IRPF'
                      : 'Lista'
              }
            >
              {view === 'dashboard' && <ChartBarIcon className="w-6 h-6" />}
              {view === 'cashflow' && <span className="text-sm">📊</span>}
              {view === 'irpf' && <span className="text-sm font-medium">IR</span>}
              {view === 'list' && <ListIcon className="w-6 h-6" />}
            </button>
          ))}

          <button
            onClick={onOpenRecurring}
            className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-md shadow hover:bg-gray-700"
            title="Contas Fixas (R)"
          >
            <CalendarIcon className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Fixas</span>
          </button>
          <button
            onClick={onAddTransaction}
            className="flex items-center bg-indigo-600 text-white px-3 py-2 rounded-md shadow hover:bg-indigo-700"
            title="Adicionar (Ctrl+N)"
          >
            <PlusIcon className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>

      {/* Painel de atalhos */}
      {showShortcuts && (
        <div className="bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
            {shortcutsList.map((s) => (
              <span key={s.keys}>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  {s.keys}
                </kbd>{' '}
                {s.action}
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
