import React from 'react';
import { Transaction } from '../types';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteSeries: boolean) => void;
  transactionsToDelete: Transaction[];
  totalTransactions: number; // For "selected X of Y" or just count
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactionsToDelete,
}) => {
  if (!isOpen) return null;

  const count = transactionsToDelete.length;
  const hasSeries = transactionsToDelete.some((t) => !!t.seriesId);
  const seriesCount = new Set(
    transactionsToDelete.filter((t) => !!t.seriesId).map((t) => t.seriesId)
  ).size;

  const [deleteSeries, setDeleteSeries] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-fadeIn">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Confirmar Exclusão
        </h3>

        <div className="mb-6 text-gray-700 dark:text-gray-300">
          <p className="mb-2">
            Você está prestes a excluir <strong>{count}</strong> lançamento(s).
          </p>

          {hasSeries && (
            <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded border border-amber-200 dark:border-amber-800 mt-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Atenção: Itens parcelados selecionados
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Alguns lançamentos selecionados fazem parte de parcelamentos ({seriesCount} série(s)).
              </p>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={deleteSeries}
                  onChange={(e) => setDeleteSeries(e.target.checked)}
                />
                <span className="text-sm">
                  Excluir também todas as outras parcelas relacionadas a estes lançamentos?
                </span>
              </label>
            </div>
          )}

          {!hasSeries && (
            <p className="text-sm text-gray-500">
              Esta ação não pode ser desfeita.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(deleteSeries)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Excluir {count > 1 ? 'Selecionados' : 'Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
};
