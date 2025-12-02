import React, { useState } from 'react';
import { RecurringTransaction, Account } from './types';
import RecurringTransactionForm from './RecurringTransactionForm';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  recurringTransactions: RecurringTransaction[];
  setRecurringTransactions: React.Dispatch<
    React.SetStateAction<RecurringTransaction[]>
  >;
  onGenerate: (month: number, year: number) => void;
  onSaveItem: (transaction: RecurringTransaction) => void;
  onDeleteItem: (id: string) => void;
}

const RecurringTransactionsModal: React.FC<
  RecurringTransactionsModalProps
> = ({
  isOpen,
  onClose,
  accounts,
  recurringTransactions,
  setRecurringTransactions,
  onGenerate,
  onSaveItem,
  onDeleteItem,
}) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [transactionToEdit, setTransactionToEdit] =
    useState<RecurringTransaction | null>(null);

  const [generationDate, setGenerationDate] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  if (!isOpen) return null;

  const handleEdit = (transaction: RecurringTransaction) => {
    setTransactionToEdit(transaction);
    setIsFormVisible(true);
  };

  const handleAddNew = () => {
    setTransactionToEdit(null);
    setIsFormVisible(true);
  };

  const handleSave = (transaction: RecurringTransaction) => {
    if (transactionToEdit) {
      setRecurringTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? transaction : t))
      );
    } else {
      setRecurringTransactions((prev) => [...prev, transaction]);
    }
    onSaveItem(transaction);
    setIsFormVisible(false);
    setTransactionToEdit(null);
  };

  const handleGenerateClick = () => {
    onGenerate(generationDate.month, generationDate.year);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start sm:items-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl my-4 sm:my-8">
        <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Gerenciar Contas Fixas
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <select
                  value={generationDate.month}
                  onChange={(e) =>
                    setGenerationDate((d) => ({
                      ...d,
                      month: parseInt(e.target.value),
                    }))
                  }
                  className="p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500 w-1/2 sm:w-auto"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    )
                  )}
                </select>
                <select
                  value={generationDate.year}
                  onChange={(e) =>
                    setGenerationDate((d) => ({
                      ...d,
                      year: parseInt(e.target.value),
                    }))
                  }
                  className="p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500 w-1/2 sm:w-auto"
                >
                  {Array.from({ length: 10 }, (_, i) =>
                    new Date().getFullYear() - 5 + i
                  ).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerateClick}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Gerar Lançamentos
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Conta
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {recurringTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {t.description}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-300">
                      {t.accountName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                      R$ {t.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDeleteItem(t.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}

                {recurringTransactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm"
                    >
                      Nenhuma conta fixa cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAddNew}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              + Nova conta fixa
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Fechar
            </button>
          </div>

          {isFormVisible && (
            <RecurringTransactionForm
              onSave={handleSave}
              onClose={() => setIsFormVisible(false)}
              accounts={accounts}
              transactionToEdit={transactionToEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RecurringTransactionsModal;
