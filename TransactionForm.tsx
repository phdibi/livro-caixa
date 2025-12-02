import React, { useState, useEffect } from 'react';
import {
  Transaction,
  TransactionType,
  Account,
  ReceiptStatus,
  IrCategory,
} from './types';

interface SavePayload {
  transaction: Transaction;
  installmentsCount?: number;
  firstInstallmentDate?: string;
  updateScope?: 'single' | 'future';
}

interface TransactionFormProps {
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
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  );
};

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionToEdit,
  accounts,
  transactions,
}) => {
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
    receiptStatus: ReceiptStatus.NONE,
    irCategory: IrCategory.NAO_DEDUTIVEL,
    irNotes: '',
  });

  const [transaction, setTransaction] = useState<Omit<Transaction, 'id'>>(
    getInitialState()
  );
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [updateScope, setUpdateScope] =
    useState<'single' | 'future'>('single');

  const isEditingInstallment = !!transactionToEdit?.seriesId;

  // Quando o modal abre / muda o registro em edição
  useEffect(() => {
    if (!isOpen) return;

    if (transactionToEdit) {
      const merged: Omit<Transaction, 'id'> = {
        ...transactionToEdit,
        quantity: transactionToEdit.quantity ?? 1,
        unitValue: transactionToEdit.unitValue ?? transactionToEdit.amount,
        receiptStatus:
          transactionToEdit.receiptStatus ?? ReceiptStatus.NONE,
        irCategory:
          transactionToEdit.irCategory ?? IrCategory.NAO_DEDUTIVEL,
        irNotes: transactionToEdit.irNotes ?? '',
      };

      // removemos o id porque o estado é Omit<Transaction, 'id'>
      // e o id será reatribuído ao salvar
      const { id: _discardId, ...rest } = merged as Transaction;

      setTransaction(rest);
      setFirstInstallmentDate(transactionToEdit.date);
      setUpdateScope('single');

      if (isEditingInstallment && transactionToEdit.seriesId) {
        const totalInstallmentsForSeries = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        ).length;
        setInstallmentsCount(totalInstallmentsForSeries || 1);
      } else {
        setInstallmentsCount(1);
      }
    } else {
      const initial = getInitialState();
      setTransaction(initial);
      setInstallmentsCount(1);
      setFirstInstallmentDate(initial.date);
    }
  }, [isOpen, transactionToEdit, accounts, transactions, isEditingInstallment]);

  // Atualiza automaticamente o valor total = quantidade * valor unitário
  useEffect(() => {
    const qty = transaction.quantity || 0;
    const unitVal = transaction.unitValue || 0;

    if (document.activeElement?.getAttribute('name') !== 'amount') {
      setTransaction((prev) => ({
        ...prev,
        amount: qty * unitVal,
      }));
    }
  }, [transaction.quantity, transaction.unitValue]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Campos especiais de enum / string
    if (name === 'receiptStatus') {
      setTransaction((prev) => ({
        ...prev,
        receiptStatus: value as ReceiptStatus,
      }));
      return;
    }

    if (name === 'irCategory') {
      setTransaction((prev) => ({
        ...prev,
        irCategory: value as IrCategory,
      }));
      return;
    }

    let numericValue: string | number = ['amount', 'quantity', 'unitValue'].includes(
      name
    )
      ? parseFloat(value)
      : value;

    if (name === 'accountNumber') {
      const parsedNumber = parseInt(value, 10);
      const selectedAccount = accounts.find(
        (acc) => acc.number === parsedNumber
      );
      setTransaction((prev) => ({
        ...prev,
        accountNumber: parsedNumber,
        accountName: selectedAccount?.name || '',
      }));
    } else {
      setTransaction((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: SavePayload = {
      transaction: {
        ...(transaction as Transaction),
        id: transactionToEdit?.id || generateId(),
      },
      updateScope: isEditingInstallment ? updateScope : undefined,
      installmentsCount: installmentsCount,
      firstInstallmentDate: firstInstallmentDate,
    };

    onSave(payload);
    onClose();
  };

  const getBaseDescription = (desc: string) => {
    return desc.replace(/\s\(\d+\/\d+\)$/, '');
  };

  const irCategoryOptions: { value: IrCategory; label: string }[] = [
    { value: IrCategory.NAO_DEDUTIVEL, label: 'Não dedutível / geral' },
    { value: IrCategory.SAUDE, label: 'Saúde (dedutível)' },
    { value: IrCategory.EDUCACAO, label: 'Educação (dedutível)' },
    { value: IrCategory.LIVRO_CAIXA, label: 'Livro caixa (autônomo)' },
    { value: IrCategory.CARNE_LEAO, label: 'Carnê Leão (autônomo)' },
    { value: IrCategory.ALUGUEL, label: 'Aluguel' },
    { value: IrCategory.BEM_DIREITO, label: 'Bens e direitos' },
    { value: IrCategory.ATIVIDADE_RURAL, label: 'Atividade Rural' },
    { value: IrCategory.OUTRA, label: 'Outra categoria' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 my-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {transactionToEdit ? 'Editar' : 'Adicionar'} Lançamento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Aviso para edição de série parcelada */}
          {isEditingInstallment && (
            <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-md space-y-3">
              <div>
                <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                  Esta é uma transação parcelada. Como deseja salvar as
                  alterações?
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="single"
                      checked={updateScope === 'single'}
                      onChange={() => setUpdateScope('single')}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Somente este lançamento
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="future"
                      checked={updateScope === 'future'}
                      onChange={() => setUpdateScope('future')}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Este e os futuros
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Data e tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Data
              </label>
              <input
                type="date"
                name="date"
                value={transaction.date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value={TransactionType.SAIDA}>Saída</option>
                <option value={TransactionType.ENTRADA}>Entrada</option>
              </select>
            </div>
          </div>

          {/* Conta */}
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
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.number}>
                  {acc.number} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Histórico */}
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
              value={
                isEditingInstallment
                  ? getBaseDescription(transaction.description)
                  : transaction.description
              }
              onChange={(e) => {
                const newValue = e.target.value;
                setTransaction((prev) => {
                  if (isEditingInstallment) {
                    const base = getBaseDescription(prev.description);
                    const suffix = prev.description.substring(base.length);
                    return {
                      ...prev,
                      description: newValue + suffix,
                    };
                  }
                  return { ...prev, description: newValue };
                });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Quantidade, valor unitário, total */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Quant.
              </label>
              <input
                type="number"
                step="any"
                name="quantity"
                value={transaction.quantity ?? 0}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="unitValue"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Vlr. Unitário
              </label>
              <input
                type="number"
                step="any"
                name="unitValue"
                value={transaction.unitValue ?? 0}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Valor Total
              </label>
              <input
                type="number"
                step="0.01"
                name="amount"
                value={transaction.amount}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white font-bold"
                required
              />
            </div>
          </div>

          {/* Fornecedor / Comprador */}
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
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* BLOCO FISCAL / IR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoria de IR */}
            <div>
              <label
                htmlFor="irCategory"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Categoria para IR
              </label>
              <select
                name="irCategory"
                value={transaction.irCategory ?? IrCategory.NAO_DEDUTIVEL}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                {irCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status do comprovante */}
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Comprovante fiscal
              </span>
              <div className="space-y-1 text-sm">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="receiptStatus"
                    value={ReceiptStatus.NONE}
                    checked={
                      (transaction.receiptStatus ?? ReceiptStatus.NONE) ===
                      ReceiptStatus.NONE
                    }
                    onChange={handleChange}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">
                    Não tenho comprovante
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="receiptStatus"
                    value={ReceiptStatus.HAS_BUT_NOT_ATTACHED}
                    checked={
                      transaction.receiptStatus ===
                      ReceiptStatus.HAS_BUT_NOT_ATTACHED
                    }
                    onChange={handleChange}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">
                    Tenho, mas ainda não anexei
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="receiptStatus"
                    value={ReceiptStatus.ATTACHED}
                    checked={transaction.receiptStatus === ReceiptStatus.ATTACHED}
                    onChange={handleChange}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">
                    Comprovante anexado
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      (O upload será configurado em outra etapa)
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Observações para IR */}
          <div>
            <label
              htmlFor="irNotes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Observações para IR (opcional)
            </label>
            <textarea
              name="irNotes"
              value={transaction.irNotes ?? ''}
              onChange={(e) =>
                setTransaction((prev) => ({
                  ...prev,
                  irNotes: e.target.value,
                }))
              }
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              placeholder="Ex.: consulta médica do dependente, mensalidade da escola, aluguel do imóvel X..."
            />
          </div>

          {/* Parcelas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="installments"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Nº de Parcelas
              </label>
              <input
                type="number"
                name="installments"
                min={1}
                step={1}
                value={installmentsCount}
                onChange={(e) =>
                  setInstallmentsCount(
                    Math.max(1, parseInt(e.target.value || '1', 10))
                  )
                }
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            {installmentsCount > 1 && !isEditingInstallment && (
              <div>
                <label
                  htmlFor="firstInstallmentDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Data da 1ª Parcela
                </label>
                <input
                  type="date"
                  name="firstInstallmentDate"
                  value={firstInstallmentDate}
                  onChange={(e) =>
                    setFirstInstallmentDate(e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            )}
          </div>
          {isEditingInstallment && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
              Alterar o número de parcelas irá recriar toda a série com os
              dados do formulário.
            </p>
          )}

          {/* Botões */}
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
