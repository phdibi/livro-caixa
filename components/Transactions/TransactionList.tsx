import React, { useCallback, useState } from 'react';
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
import Pagination from '../../Pagination';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface TransactionListProps {
    transactions: Transaction[]; // Paginated items
    allTransactionsCount: number; // For empty state msg or stats?
    pagination: any; // The return of usePagination
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    onEdit: (t: Transaction) => void;
    onDelete: (ids: string[], deleteSeries: boolean) => Promise<void>;
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
    // Estado de seleção
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemsToDelete, setItemsToDelete] = useState<Transaction[]>([]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === transactions.length && transactions.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map((t) => t.id)));
        }
    };

    const getInvoiceRowClasses = useCallback(
        (t: Transaction): string => {
            if (!t.invoiceId) return '';
            const invoiceItems = invoiceGroups.get(t.invoiceId);
            if (!invoiceItems || invoiceItems.length <= 1) return '';
            return 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-400';
        },
        [invoiceGroups]
    );

    // Handlers para exclusão
    const handleDeleteClick = (transaction: Transaction) => {
        setItemsToDelete([transaction]);
        setIsDeleteModalOpen(true);
    };

    const handleBatchDeleteClick = () => {
        const toDelete = transactions.filter((t) => selectedIds.has(t.id));
        setItemsToDelete(toDelete);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async (deleteSeries: boolean) => {
        const ids = itemsToDelete.map((t) => t.id);
        await onDelete(ids, deleteSeries);
        setIsDeleteModalOpen(false);
        setSelectedIds(new Set());
        setItemsToDelete([]);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mt-4">
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                transactionsToDelete={itemsToDelete}
                totalTransactions={transactions.length}
            />

            <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700 min-h-[60px]">
                {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-4 w-full animate-fadeIn bg-indigo-50 dark:bg-indigo-900/20 -mx-4 px-4 py-2">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            {selectedIds.size} selecionado(s)
                        </span>
                        <button
                            onClick={handleBatchDeleteClick}
                            className="ml-auto text-sm bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                            Excluir Selecionados
                        </button>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/60">
                        <tr>
                            <th className="px-3 py-2 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={
                                        transactions.length > 0 &&
                                        selectedIds.size === transactions.length
                                    }
                                    onChange={toggleSelectAll}
                                />
                            </th>
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
                                )} ${selectedIds.has(t.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                            >
                                <td className="px-3 py-2">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={selectedIds.has(t.id)}
                                        onChange={() => toggleSelection(t.id)}
                                    />
                                </td>
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
                                        onClick={() => handleDeleteClick(t)}
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
                                    colSpan={10}
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
