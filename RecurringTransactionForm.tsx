import React, { useState, useEffect } from 'react';
import { RecurringTransaction, TransactionType, Account, IrCategory } from './types';

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

const RecurringTransactionForm: React.FC<RecurringTransactionFormProps> = ({
    onSave,
    onClose,
    accounts,
    transactionToEdit,
}) => {
    const getInitialState = (): Omit<RecurringTransaction, 'id'> => ({
        dayOfMonth: 1,
        type: TransactionType.SAIDA,
        accountNumber: accounts.length > 0 ? accounts[0].number : 0,
        accountName: accounts.length > 0 ? accounts[0].name : '',
        description: '',
        amount: 0,
        payee: '',
        paymentMethod: 'pix',
        // campos novos para IR
        irCategory: IrCategory.NAO_DEDUTIVEL,
        requiresReceipt: false,
    });

    const [transaction, setTransaction] = useState<Omit<RecurringTransaction, 'id'>>(getInitialState());

    useEffect(() => {
        if (transactionToEdit) {
            // garante defaults para registros antigos
            const withDefaults: Omit<RecurringTransaction, 'id'> = {
                ...transactionToEdit,
                irCategory: transactionToEdit.irCategory ?? IrCategory.NAO_DEDUTIVEL,
                requiresReceipt: transactionToEdit.requiresReceipt ?? false,
            };
            const { id: _discard, ...rest } = withDefaults as RecurringTransaction;
            setTransaction(rest);
        } else {
            setTransaction(getInitialState());
        }
    }, [transactionToEdit, accounts]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // campos especiais
        if (name === 'irCategory') {
            setTransaction(prev => ({ ...prev, irCategory: value as IrCategory }));
            return;
        }

        if (name === 'requiresReceipt') {
            const checked = (e.target as HTMLInputElement).checked;
            setTransaction(prev => ({ ...prev, requiresReceipt: checked }));
            return;
        }

        let finalValue: string | number = value;

        if (name === 'amount') {
            finalValue = parseFloat(value) || 0;
        } else if (name === 'dayOfMonth' || name === 'accountNumber') {
            finalValue = parseInt(value, 10);
        }

        const updatedTransaction: any = { ...transaction, [name]: finalValue };

        if (name === 'accountNumber') {
            const selectedAccount = accounts.find(acc => acc.number === updatedTransaction.accountNumber);
            updatedTransaction.accountName = selectedAccount?.name || '';
        }

        setTransaction(updatedTransaction);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...transaction,
            id: transactionToEdit?.id || generateId(),
        });
        onClose();
    };

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                {transactionToEdit ? 'Editar' : 'Adicionar'} Conta Fixa
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label
                            htmlFor="dayOfMonth"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Dia do Vencimento
                        </label>
                        <input
                            type="number"
                            name="dayOfMonth"
                            min="1"
                            max="31"
                            value={transaction.dayOfMonth}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="type"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Tipo
                        </label>
                        <select
                            name="type"
                            value={transaction.type}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                        >
                            <option value={TransactionType.SAIDA}>Saída</option>
                            <option value={TransactionType.ENTRADA}>Entrada</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="accountNumber"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Conta
                    </label>
                    <select
                        name="accountNumber"
                        value={transaction.accountNumber}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.number}>
                                {acc.number} - {acc.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Histórico
                    </label>
                    <input
                        type="text"
                        name="description"
                        value={transaction.description}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                        required
                    />
                </div>

                <div>
                    <label
                        htmlFor="amount"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Valor Fixo
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        name="amount"
                        value={transaction.amount}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                        required
                    />
                </div>

                <div>
                    <label
                        htmlFor="payee"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Fornecedor/Comprador
                    </label>
                    <input
                        type="text"
                        name="payee"
                        value={transaction.payee}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label
                        htmlFor="paymentMethod"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Forma de Pagamento
                    </label>
                    <input
                        type="text"
                        name="paymentMethod"
                        value={transaction.paymentMethod}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                </div>

                {/* BLOCO DE IMPOSTO DE RENDA */}
                <div className="border rounded-md p-3 mt-2 bg-gray-100 dark:bg-gray-900/40 space-y-3">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        Imposto de Renda (padrão desta conta fixa)
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="irCategory"
                                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Categoria para IR
                            </label>
                            <select
                                name="irCategory"
                                value={transaction.irCategory ?? IrCategory.NAO_DEDUTIVEL}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                            >
                                <option value={IrCategory.NAO_DEDUTIVEL}>
                                    Não dedutível / Geral
                                </option>
                                <option value={IrCategory.SAUDE}>Saúde</option>
                                <option value={IrCategory.EDUCACAO}>Educação</option>
                                <option value={IrCategory.LIVRO_CAIXA}>Livro Caixa</option>
                                <option value={IrCategory.CARNE_LEAO}>Carnê-Leão</option>
                                <option value={IrCategory.BEM_DIREITO}>Bens e direitos</option>
                                <option value={IrCategory.ALUGUEL}>Aluguel</option>
                                <option value={IrCategory.ATIVIDADE_RURAL}>Atividade Rural</option>
                                <option value={IrCategory.OUTRA}>Outros</option>
                            </select>
                        </div>

                        <div className="flex items-center mt-2 md:mt-6">
                            <label className="inline-flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                                <input
                                    type="checkbox"
                                    name="requiresReceipt"
                                    checked={!!transaction.requiresReceipt}
                                    onChange={handleChange}
                                    className="form-checkbox h-4 w-4 text-indigo-600"
                                />
                                <span className="ml-2">
                                    Normalmente exige nota/comprovante
                                </span>
                            </label>
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Essas configurações serão usadas como padrão quando você gerar os
                        lançamentos mensais a partir desta conta fixa, ajudando a organizar o
                        relatório de Imposto de Renda.
                    </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                    >
                        Salvar Conta
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RecurringTransactionForm;
