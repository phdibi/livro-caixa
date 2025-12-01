import React, { useState } from 'react';
import { Account } from './types';
import { FilterIcon } from './Icons';

interface TransactionFilterProps {
  filters: {
    searchTerm: string;
    type: string;
    accountId: string;
    startDate: string;
    endDate: string;
  };
  onFilterChange: React.Dispatch<React.SetStateAction<any>>;
  accounts: Account[];
}

const TransactionFilter: React.FC<TransactionFilterProps> = ({ filters, onFilterChange, accounts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange((prev: any) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    onFilterChange({
      searchTerm: '',
      type: '',
      accountId: '',
      startDate: '',
      endDate: '',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center md:hidden mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtros</h3>
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
          <input
            type="text"
            name="searchTerm"
            value={filters.searchTerm}
            onChange={handleInputChange}
            placeholder="Buscar no histórico..."
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <select
            name="type"
            value={filters.type}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos os Tipos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saida">Saída</option>
          </select>
          <select
            name="accountId"
            value={filters.accountId}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todas as Contas</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.number}>
                {acc.number} - {acc.name}
              </option>
            ))}
          </select>

          {/* RANGE DE DATAS AJUSTADO */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleInputChange}
              className="flex-1 min-w-0 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap text-center sm:text-left">
              até
            </span>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleInputChange}
              className="flex-1 min-w-0 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilter;
