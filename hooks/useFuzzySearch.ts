import { useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { Transaction } from '../types';

interface FuzzySearchOptions {
  threshold?: number; // 0 = exact match, 1 = match everything (default: 0.3)
  minMatchCharLength?: number;
  includeScore?: boolean;
}

interface FuzzySearchResult {
  item: Transaction;
  score?: number;
  refIndex?: number;
}

const DEFAULT_KEYS = [
  { name: 'description', weight: 0.4 },
  { name: 'payee', weight: 0.3 },
  { name: 'accountName', weight: 0.2 },
  { name: 'notes', weight: 0.1 },
];

/**
 * Hook para busca fuzzy em transações
 * Permite encontrar transações mesmo com erros de digitação
 */
export function useFuzzySearch(
  transactions: Transaction[],
  options: FuzzySearchOptions = {}
) {
  const { threshold = 0.35, minMatchCharLength = 2, includeScore = false } = options;

  // Criar índice Fuse apenas quando transactions mudar
  const fuse = useMemo(() => {
    return new Fuse(transactions, {
      keys: DEFAULT_KEYS,
      threshold,
      minMatchCharLength,
      includeScore,
      // Opções adicionais para melhor matching em português
      ignoreLocation: true, // Busca em qualquer posição
      findAllMatches: true,
      useExtendedSearch: true,
    });
  }, [transactions, threshold, minMatchCharLength, includeScore]);

  /**
   * Executa busca fuzzy
   * @param searchTerm Termo de busca
   * @returns Array de transações que correspondem à busca
   */
  const search = useCallback(
    (searchTerm: string): Transaction[] => {
      if (!searchTerm || searchTerm.trim().length < minMatchCharLength) {
        return transactions;
      }

      const trimmedTerm = searchTerm.trim();

      // Se o termo tem números, pode ser um valor - fazer busca exata também
      const isNumericSearch = /^\d+([.,]\d+)?$/.test(trimmedTerm.replace(/\s/g, ''));

      if (isNumericSearch) {
        // Para números, fazer busca exata no campo amount
        const numericValue = parseFloat(trimmedTerm.replace(',', '.'));
        const exactMatches = transactions.filter((t) =>
          t.amount.toString().includes(trimmedTerm.replace(',', '.'))
        );

        if (exactMatches.length > 0) {
          return exactMatches;
        }
      }

      // Busca fuzzy normal
      const results = fuse.search(trimmedTerm);
      return results.map((result) => result.item);
    },
    [fuse, transactions, minMatchCharLength]
  );

  /**
   * Executa busca fuzzy com scores
   * @param searchTerm Termo de busca
   * @returns Array com resultados e scores
   */
  const searchWithScore = useCallback(
    (searchTerm: string): FuzzySearchResult[] => {
      if (!searchTerm || searchTerm.trim().length < minMatchCharLength) {
        return transactions.map((item, index) => ({ item, refIndex: index }));
      }

      const trimmedTerm = searchTerm.trim();
      return fuse.search(trimmedTerm);
    },
    [fuse, transactions, minMatchCharLength]
  );

  /**
   * Verifica se há resultados para um termo
   */
  const hasResults = useCallback(
    (searchTerm: string): boolean => {
      if (!searchTerm || searchTerm.trim().length < minMatchCharLength) {
        return transactions.length > 0;
      }
      return fuse.search(searchTerm.trim()).length > 0;
    },
    [fuse, transactions, minMatchCharLength]
  );

  /**
   * Obtém sugestões de autocompletar baseadas no termo
   */
  const getSuggestions = useCallback(
    (searchTerm: string, maxSuggestions = 5): string[] => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      const results = fuse.search(searchTerm.trim()).slice(0, maxSuggestions);
      const suggestions = new Set<string>();

      results.forEach((result) => {
        // Adicionar descrições e payees únicos como sugestões
        suggestions.add(result.item.description);
        if (result.item.payee) {
          suggestions.add(result.item.payee);
        }
      });

      return Array.from(suggestions).slice(0, maxSuggestions);
    },
    [fuse]
  );

  return {
    search,
    searchWithScore,
    hasResults,
    getSuggestions,
    totalTransactions: transactions.length,
  };
}

export default useFuzzySearch;
