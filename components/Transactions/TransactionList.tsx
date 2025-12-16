import React, { useCallback } from 'react';
import { Transaction, ReceiptStatus, isEntrada } from '../../types';
import { EditIcon, TrashIcon } from '../../Icons';
import {
    formatCurrency,
    formatDisplayDate,
} from '../../utils/formatters';
import {
    receiptStatusLabel,
    receiptStatusClasses,
    irCategoryLabel,
} from '../../utils/labels';
import Pagination from '../../Pagination'; // Assuming Pagination is in root or components? Check App.tsx

// Pagination is imported as: import Pagination from './Pagination'; in App.tsx
// So it is in root. ../../Pagination.

interface TransactionListProps {
    transactions: Transaction[]; // Paginated items
    allTransactionsCount: number; // For empty state msg or stats?
    pagination: any; // The return of usePagination
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    invoiceGroups: Map<string, Transaction[]>;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    pagination,
    sortOrder,
    setSortOrder,
    onEdit,
    onDelete,
    invoiceGroups,
    onLoadMore,
    isLoadingMore = false,
}) => {
    const getInvoiceRowClasses = useCallback(
        (t: Transaction): string => {
            if (!t.invoiceId) return '';
            const invoiceItems = invoiceGroups.get(t.invoiceId);
            if (!invoiceItems || invoiceItems.length <= 1) return '';
            return 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-400';
        },
        [invoiceGroups]
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mt-4">
            <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Lançamentos</h2>
                    <span className="text-xs text-gray-500">
                        ({pagination.totalItems})
                    </span>
                </div>
                <button
                    onClick={() =>
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    className="text-xs text-gray-500"
                >
                    Data ({sortOrder === 'asc' ? '↑' : '↓'})
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/60">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Data
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Tipo
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Conta
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Histórico
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Fornecedor
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Comprovante
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Categoria IR
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                                Valor
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {transactions.map((t) => (
                            <tr
                                key={t.id}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 ${getInvoiceRowClasses(
                                    t
                                )}`}
                            >
                                <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                    {formatDisplayDate(t.date)}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${isEntrada(t)
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                            }`}
                                    >
                                        {t.type}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                                    {t.accountNumber} - {t.accountName}
                                </td>
                                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                                    {t.description}
                                    {t.isContaTiti && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                            Conta Titi
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {t.payee}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${receiptStatusClasses(
                                            t.receiptStatus
                                        )}`}
                                    >
                                        {receiptStatusLabel(t.receiptStatus)}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                    {irCategoryLabel(t.irCategory)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                    {formatCurrency(t.amount)}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <button
                                        onClick={() => onEdit(t)}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-1"
                                        title="Editar"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(t.id)}
                                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/60"
                                        title="Excluir"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-6 text-center text-gray-500"
                                >
                                    Nenhum lançamento encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.goToPage}
                pageSize={pagination.pageSize}
                onPageSizeChange={pagination.setPageSize}
                totalItems={pagination.totalItems}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
            />

            {onLoadMore && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-center">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline disabled:opacity-50"
                    >
                        {isLoadingMore ? 'Carregando...' : 'Carregar transações mais antigas'}
                    </button>
                </div>
            )}
        </div>
    );
};
