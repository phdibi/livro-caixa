import React, { useState, useCallback } from 'react';
import { Account } from './types';
import { FilterIcon } from './Icons';
import { parseBrazilianDate } from './validation';

interface Filters {
  searchTerm: string;
  type: string;
  accountId: string;
  startDate: string;
  endDate: string;
}

interface TransactionFilterProps {
  filters: Filters;
  onFilterChange: (filters: Filters | ((prev: Filters) => Filters)) => void;
  accounts: Account[];
  onClear?: () => void;
}

const TransactionFilter: React.FC<TransactionFilterProps> = ({
  filters,
  onFilterChange,
  accounts,
  onClear,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Estados locais para inputs de data em formato brasileiro
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      onFilterChange((prev) => ({ ...prev, [name]: value }));
    },
    [onFilterChange]
  );

  // Handler especial para data com suporte a formato brasileiro
  const handleDateInput = useCallback(
    (name: 'startDate' | 'endDate', value: string) => {
      // Tentar parse de data brasileira (dd/mm/yyyy)
      const isoDate = parseBrazilianDate(value);
      
      if (isoDate) {
        // Se conseguiu parsear, usar data ISO
        onFilterChange((prev) => ({ ...prev, [name]: isoDate }));
        if (name === 'startDate') setStartDateInput('');
        else setEndDateInput('');
      } else if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Se já está em formato ISO (do date picker)
        onFilterChange((prev) => ({ ...prev, [name]: value }));
      }
    },
    [onFilterChange]
  );

  const handleClear = useCallback(() => {
    setStartDateInput('');
    setEndDateInput('');
    if (onClear) {
      onClear();
    } else {
      onFilterChange({
        searchTerm: '',
        type: '',
        accountId: '',
        startDate: '',
        endDate: '',
      });
    }
  }, [onClear, onFilterChange]);

  // Contar filtros ativos
  const activeFiltersCount = [
    filters.searchTerm,
    filters.type,
    filters.accountId,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center md:hidden mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Filtros
          </h3>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm"
        >
          <FilterIcon className="w-4 h-4 mr-1" />
          {isExpanded ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      <div className={`${isExpanded ? 'block' : 'hidden'} md:block space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca com placeholder melhorado */}
          <div className="relative">
            <input
              type="text"
              name="searchTerm"
              value={filters.searchTerm}
              onChange={handleInputChange}
              placeholder="Buscar (histórico, fornecedor, conta)..."
              className="w-full p-2 pl-8 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Tipo */}
          <select
            name="type"
            value={filters.type}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          >
            <option value="">Todos os Tipos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saida">Saída</option>
          </select>

          {/* Conta */}
          <select
            name="accountId"
            value={filters.accountId}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          >
            <option value="">Todas as Contas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.number}>
                {acc.number} - {acc.name}
              </option>
            ))}
          </select>

          {/* Range de datas com suporte a formato brasileiro */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={(e) => handleDateInput('startDate', e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                placeholder="dd/mm/aaaa"
              />
              {/* Input alternativo para formato brasileiro */}
              <input
                type="text"
                value={startDateInput}
                onChange={(e) => {
                  setStartDateInput(e.target.value);
                  handleDateInput('startDate', e.target.value);
                }}
                placeholder="dd/mm/aaaa"
                className="absolute inset-0 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm opacity-0 focus:opacity-100"
                onBlur={() => setStartDateInput('')}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap text-center sm:text-left">
              até
            </span>
            <div className="relative flex-1">
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={(e) => handleDateInput('endDate', e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {/* Dica sobre formato de data */}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Dica: digite datas no formato dd/mm/aaaa
          </span>

          <button
            onClick={handleClear}
            disabled={activeFiltersCount === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Limpar Filtros
            {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilter;