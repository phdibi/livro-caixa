
import React, { useState, useEffect } from 'react';
import { RecurringTransaction, TransactionType, Account } from '../types';

interface RecurringTransactionFormProps {
    onSave: (transaction: RecurringTransaction) => void;
    onClose: () => void;
    accounts: Account[];
    transactionToEdit?: RecurringTransaction | null;
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const RecurringTransactionForm: React.FC<RecurringTransactionFormProps> = ({ onSave, onClose, accounts, transactionToEdit }) => {
    const getInitialState = (): Omit<RecurringTransaction, 'id'> => ({
        dayOfMonth: 1,
        type: TransactionType.SAIDA,
        accountNumber: accounts.length > 0 ? accounts[0].number : 0,
        accountName: accounts.length > 0 ? accounts[0].name : '',
        description: '',
        amount: 0,
        payee: '',
        paymentMethod: 'pix',
    });

    const [transaction, setTransaction] = useState(getInitialState());

    useEffect(() => {
        if (transactionToEdit) {
            setTransaction(transactionToEdit);
        } else {
            setTransaction(getInitialState());
        }
    }, [transactionToEdit, accounts]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let finalValue: string | number = value;

        if (name === 'amount') {
            finalValue = parseFloat(value) || 0;
        } else if (name === 'dayOfMonth' || name === 'accountNumber') {
            finalValue = parseInt(value, 10);
        }
        
        const updatedTransaction = { ...transaction, [name]: finalValue };

        if (name === "accountNumber") {
            const selectedAccount = accounts.find(acc => acc.number === updatedTransaction.accountNumber);
            updatedTransaction.accountName = selectedAccount?.name || '';
        }

        setTransaction(updatedTransaction);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...transaction, id: transactionToEdit?.id || generateId() });
        onClose();
    };

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{transactionToEdit ? 'Editar' : 'Adicionar'} Conta Fixa</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dayOfMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dia do Vencimento</label>
                        <input type="number" name="dayOfMonth" min="1" max="31" value={transaction.dayOfMonth} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                        <select name="type" value={transaction.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white">
                            <option value={TransactionType.SAIDA}>Saída</option>
                            <option value={TransactionType.ENTRADA}>Entrada</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Conta</label>
                    <select name="accountNumber" value={transaction.accountNumber} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white">
                        {accounts.map(acc => <option key={acc.id} value={acc.number}>{acc.number} - {acc.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Histórico</label>
                    <input type="text" name="description" value={transaction.description} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white" required />
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valor Fixo</label>
                    <input type="number" step="0.01" name="amount" value={transaction.amount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white" required />
                </div>
                <div>
                    <label htmlFor="payee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fornecedor/Comprador</label>
                    <input type="text" name="payee" value={transaction.payee} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar Conta</button>
                </div>
            </form>
        </div>
    );
};

export default RecurringTransactionForm;
