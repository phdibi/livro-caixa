import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onAddTransaction?: () => void;
  onToggleView?: () => void;
  onOpenRecurring?: () => void;
  onExport?: () => void;
  onSync?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorar se estiver em input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Só permite ESC em inputs
      if (e.key === 'Escape' && handlers.onEscape) {
        handlers.onEscape();
      }
      return;
    }

    // Ctrl/Cmd + tecla
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd) {
      switch (e.key.toLowerCase()) {
        case 'n': // Novo lançamento
          e.preventDefault();
          handlers.onAddTransaction?.();
          break;
        case 'e': // Exportar
          e.preventDefault();
          handlers.onExport?.();
          break;
        case 's': // Sincronizar
          e.preventDefault();
          handlers.onSync?.();
          break;
      }
      return;
    }

    // Teclas simples
    switch (e.key) {
      case 'Escape':
        handlers.onEscape?.();
        break;
      case '1': // Dashboard
      case '2': // IRPF
      case '3': // Lista
        handlers.onToggleView?.();
        break;
      case 'r': // Recorrentes
        if (!isCtrlOrCmd) {
          handlers.onOpenRecurring?.();
        }
        break;
    }
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Componente de ajuda para mostrar atalhos
export const shortcutsList = [
  { keys: 'Ctrl+N', action: 'Novo lançamento' },
  { keys: 'Ctrl+E', action: 'Exportar' },
  { keys: 'Ctrl+S', action: 'Sincronizar' },
  { keys: 'R', action: 'Contas fixas' },
  { keys: 'ESC', action: 'Fechar modal' },
];
