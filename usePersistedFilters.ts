import { useState, useEffect, useCallback } from 'react';

interface Filters {
  searchTerm: string;
  type: string;
  accountId: string;
  startDate: string;
  endDate: string;
  includeContaTiti?: boolean;
  pendingReceipt?: boolean;
}

const STORAGE_KEY = 'livro_caixa_filters';

const defaultFilters: Filters = {
  searchTerm: '',
  type: '',
  accountId: '',
  startDate: '',
  endDate: '',
  includeContaTiti: false,
  pendingReceipt: false,
};

export function usePersistedFilters(userId: string) {
  const storageKey = `${STORAGE_KEY}_${userId}`;
  
  const [filters, setFiltersState] = useState<Filters>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return { ...defaultFilters, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Erro ao carregar filtros:', e);
    }
    return defaultFilters;
  });

  // Persistir quando mudar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (e) {
      console.error('Erro ao salvar filtros:', e);
    }
  }, [filters, storageKey]);

  const setFilters = useCallback((
    updater: Filters | ((prev: Filters) => Filters)
  ) => {
    setFiltersState(updater);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  return { filters, setFilters, clearFilters, defaultFilters };
}
