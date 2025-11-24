
import React, { useState } from 'react';
import { RecurringTransaction, Account } from './types';
import RecurringTransactionForm from './RecurringTransactionForm';
import { EditIcon, TrashIcon, PlusIcon } from './Icons';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  recurringTransactions: RecurringTransaction[];
  setRecurringTransactions: React.Dispatch<React.SetStateAction<RecurringTransaction[]>>;
  onGenerate: (year: number, month: number) => void;
  onSaveItem?: (item: RecurringTransaction) => void;
  onDeleteItem?: (id: string) => void;
}

const RecurringTransactionsModal: React.FC<RecurringTransactionsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  recurringTransactions,
  setRecurringTransactions,
  onGenerate,
  onSaveItem,
  onDeleteItem
}) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<RecurringTransaction | null>(null);
  const [generationDate, setGenerationDate] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  if (!isOpen) return null;

  const handleAddNew = () => {
    setTransactionToEdit(null);
    setIsFormVisible(true);
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setTransactionToEdit(transaction);
    setIsFormVisible(true);
  };

  const handleSave = (transaction: RecurringTransaction) => {
    if (onSaveItem) {
        onSaveItem(transaction);
    } else {
        // Fallback to local state logic if no DB handler provided
        if (transactionToEdit) {
            setRecurringTransactions(recurringTransactions.map(t => t.id === transaction.id ? transaction : t));
        } else {
            setRecurringTransactions(prev => [transaction, ...prev]);
        }
    }
    setIsFormVisible(false);
    setTransactionToEdit(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta conta fixa?')) {
      if (onDeleteItem) {
          onDeleteItem(id);
      } else {
          setRecurringTransactions(recurringTransactions.filter(t => t.id !== id));
      }
    }
  };
  
  const handleGenerateClick = () => {
    onGenerate(generationDate.year, generationDate.month);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Contas Fixas</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <select 
                        value={generationDate.month} 
                        onChange={e => setGenerationDate(d => ({...d, month: parseInt(e.target.value)}))}
                        className="p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                    >
                        {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                    </select>
                    <select 
                        value={generationDate.year} 
                        onChange={e => setGenerationDate(d => ({...d, year: parseInt(e.target.value)}))}
                        className="p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                    >
                        {Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button onClick={handleGenerateClick} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                    Gerar Lançamentos para o Mês
                </button>
            </div>

            <div className="max-h-60 overflow-y-auto">
                {recurringTransactions.length > 0 ? (
                    <ul className="divide-y dark:divide-gray-700">
                        {recurringTransactions.map(rt => (
                            <li key={rt.id} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{rt.description} - {formatCurrency(rt.amount)}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Dia {rt.dayOfMonth} | Conta: {rt.accountName}</p>
                                </div>
                                <div>
                                    <button onClick={() => handleEdit(rt)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(rt.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhuma conta fixa cadastrada.</p>
                )}
            </div>
             {!isFormVisible && (
                <button 
                    onClick={handleAddNew} 
                    className="w-full flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 mt-4"
                >
                    <PlusIcon className="w-5 h-5 mr-2"/>
                    Adicionar Nova Conta Fixa
                </button>
             )}
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
  );
};

export default RecurringTransactionsModal;
