
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Account } from '../types';

interface SavePayload {
    transaction: Transaction;
    installmentsCount?: number;
    firstInstallmentDate?: string;
    updateScope?: 'single' | 'future';
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => void;
  transactionToEdit?: Transaction | null;
  accounts: Account[];
  transactions: Transaction[];
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, transactionToEdit, accounts, transactions }) => {
  const getInitialState = (): Omit<Transaction, 'id'> => ({
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.SAIDA,
    accountNumber: accounts.length > 0 ? accounts[0].number : 0,
    accountName: accounts.length > 0 ? accounts[0].name : '',
    description: '',
    quantity: 1,
    unitValue: 0,
    amount: 0,
    payee: '',
    paymentMethod: 'pix',
  });
  
  const [transaction, setTransaction] = useState(getInitialState());
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [updateScope, setUpdateScope] = useState<'single' | 'future'>('single');

  const isEditingInstallment = !!transactionToEdit?.seriesId;

  useEffect(() => {
    if (isOpen) {
        if (transactionToEdit) {
            setTransaction({
                ...transactionToEdit,
                quantity: transactionToEdit.quantity || 1,
                unitValue: transactionToEdit.unitValue || transactionToEdit.amount,
            });
            setFirstInstallmentDate(transactionToEdit.date);
            setUpdateScope('single');
            
            if (isEditingInstallment) {
                 const totalInstallmentsForSeries = transactions.filter(t => t.seriesId === transactionToEdit.seriesId).length;
                 setInstallmentsCount(totalInstallmentsForSeries || 1);
            } else {
                 setInstallmentsCount(1);
            }
        } else {
            const initialState = getInitialState();
            setTransaction(initialState);
            setInstallmentsCount(1);
            setFirstInstallmentDate(initialState.date);
        }
    }
  }, [transactionToEdit, accounts, isOpen, transactions]);

  useEffect(() => {
    const qty = transaction.quantity || 0;
    const unitVal = transaction.unitValue || 0;
    if (document.activeElement?.getAttribute('name') !== 'amount') {
        setTransaction(prev => ({...prev, amount: qty * unitVal}));
    }
  }, [transaction.quantity, transaction.unitValue]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let numericValue: string | number = ['amount', 'quantity', 'unitValue'].includes(name) ? parseFloat(value) : value;
    
    if (name === "accountNumber") {
        const selectedAccount = accounts.find(acc => acc.number === parseInt(value));
        setTransaction(prev => ({ ...prev, accountNumber: parseInt(value), accountName: selectedAccount?.name || '' }));
    } else {
        setTransaction(prev => ({ ...prev, [name]: numericValue }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SavePayload = {
      transaction: { ...transaction, id: transactionToEdit?.id || generateId() },
      updateScope: isEditingInstallment ? updateScope : undefined,
      installmentsCount: installmentsCount,
      firstInstallmentDate: firstInstallmentDate,
    };
    onSave(payload);
    onClose();
  };

  const getBaseDescription = (desc: string) => {
      return desc.replace(/\s\(\d+\/\d+\)$/, '');
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 my-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{transactionToEdit ? 'Editar' : 'Adicionar'} Lançamento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isEditingInstallment && (
              <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-md space-y-3">
                  <div>
                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">Esta é uma transação parcelada. Como deseja salvar as alterações?</p>
                    <div className="flex space-x-4">
                        <label className="flex items-center">
                            <input type="radio" value="single" checked={updateScope === 'single'} onChange={() => setUpdateScope('single')} className="form-radio text-indigo-600"/>
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Somente este lançamento</span>
                        </label>
                        <label className="flex items-center">
                            <input type="radio" value="future" checked={updateScope === 'future'} onChange={() => setUpdateScope('future')} className="form-radio text-indigo-600"/>
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Este e os futuros</span>
                        </label>
                    </div>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data</label>
              <input type="date" name="date" value={transaction.date} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" required />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
              <select name="type" value={transaction.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                <option value={TransactionType.SAIDA}>Saída</option>
                <option value={TransactionType.ENTRADA}>Entrada</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Conta</label>
            <select name="accountNumber" value={transaction.accountNumber} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
              {accounts.map(acc => <option key={acc.id} value={acc.number}>{acc.number} - {acc.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Histórico</label>
            <input 
              type="text" 
              name="description" 
              value={isEditingInstallment ? getBaseDescription(transaction.description) : transaction.description} 
              onChange={e => {
                  const newValue = e.target.value;
                  setTransaction(prev => {
                      if (isEditingInstallment) {
                          const base = getBaseDescription(prev.description);
                          const suffix = prev.description.substring(base.length);
                          return {...prev, description: newValue + suffix};
                      }
                      return {...prev, description: newValue };
                  });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" required />
          </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quant.</label>
                    <input type="number" step="any" name="quantity" value={transaction.quantity} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="unitValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vlr. Unitário</label>
                    <input type="number" step="any" name="unitValue" value={transaction.unitValue} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valor Total</label>
                    <input type="number" step="0.01" name="amount" value={transaction.amount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white font-bold" required />
                </div>
           </div>
           <div>
              <label htmlFor="payee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fornecedor/Comprador</label>
              <input type="text" name="payee" value={transaction.payee} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="installments" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nº de Parcelas</label>
                    <input type="number" name="installments" min="1" step="1" value={installmentsCount} onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                {installmentsCount > 1 && !isEditingInstallment && (
                    <div>
                        <label htmlFor="firstInstallmentDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data da 1ª Parcela</label>
                        <input type="date" name="firstInstallmentDate" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" required />
                    </div>
                )}
            </div>
             {isEditingInstallment && <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Alterar o número de parcelas irá recriar toda a série com os dados do formulário.</p>}


          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
