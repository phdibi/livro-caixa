import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Account } from './types';

interface SavePayload {
  transaction: Transaction;
  installmentsCount?: number;
  firstInstallmentDate?: string;
  updateScope?: 'single' | 'future';
}

interface EntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => void;
  transactionToEdit?: Transaction | null;
  accounts: Account[];
  transactions: Transaction[];
}

type InvoiceItem = {
  id: string;
  accountNumber: number;
  accountName: string;
  description: string;
  quantity: number;
  unitValue: number;
  amount: number;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const EntryForm: React.FC<EntryFormProps> = ({
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
  });

  const createEmptyItem = (): InvoiceItem => ({
    id: generateId(),
    accountNumber: accounts.length > 0 ? accounts[0].number : 0,
    accountName: accounts.length > 0 ? accounts[0].name : '',
    description: '',
    quantity: 1,
    unitValue: 0,
    amount: 0,
  });

  const [transaction, setTransaction] = useState(getInitialState());
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [updateScope, setUpdateScope] = useState<'single' | 'future'>('single');

  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([createEmptyItem()]);

  const isEditingInstallment = !!transactionToEdit?.seriesId;

  // Quando abre o formulário
  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        // Edição de lançamento existente
        setTransaction({
          ...transactionToEdit,
          quantity: transactionToEdit.quantity ?? 1,
          unitValue: transactionToEdit.unitValue ?? transactionToEdit.amount,
        });
        setFirstInstallmentDate(transactionToEdit.date);
        setUpdateScope('single');
        setIsInvoiceMode(false);
        setItems([createEmptyItem()]);

        if (isEditingInstallment) {
          const totalInstallmentsForSeries = transactions.filter(
            (t) => t.seriesId === transactionToEdit.seriesId
          ).length;
          setInstallmentsCount(totalInstallmentsForSeries || 1);
        } else {
          setInstallmentsCount(1);
        }
      } else {
        // Novo lançamento
        const initialState = getInitialState();
        setTransaction(initialState);
        setInstallmentsCount(1);
        setFirstInstallmentDate(initialState.date);
        setIsInvoiceMode(false);
        setItems([createEmptyItem()]);
      }
    }
  }, [transactionToEdit, accounts, isOpen, transactions, isEditingInstallment]);

  // Atualiza automaticamente o total no modo simples
  useEffect(() => {
    if (isInvoiceMode) return;

    const qty = transaction.quantity || 0;
    const unitVal = transaction.unitValue || 0;
    if (document.activeElement?.getAttribute('name') !== 'amount') {
      setTransaction((prev) => ({ ...prev, amount: qty * unitVal }));
    }
  }, [transaction.quantity, transaction.unitValue, isInvoiceMode]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let numericValue: string | number =
      ['amount', 'quantity', 'unitValue'].includes(name) ? parseFloat(value) : value;

    if (name === 'accountNumber') {
      const selectedAccount = accounts.find(
        (acc) => acc.number === parseInt(value, 10)
      );
      setTransaction((prev) => ({
        ...prev,
        accountNumber: parseInt(value, 10),
        accountName: selectedAccount?.name || '',
      }));
    } else {
      setTransaction((prev) => ({ ...prev, [name]: numericValue }));
    }
  };

  // -------- Itens da nota fiscal --------

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        let newItem: InvoiceItem = { ...item };

        if (field === 'accountNumber') {
          const num = parseInt(value || '0', 10);
          const selected = accounts.find((acc) => acc.number === num);
          newItem.accountNumber = num;
          newItem.accountName = selected?.name || '';
        } else if (field === 'quantity') {
          const num = parseFloat(value || '0');
          newItem.quantity = isNaN(num) ? 0 : num;
        } else if (field === 'unitValue') {
          const num = parseFloat(value || '0');
          newItem.unitValue = isNaN(num) ? 0 : num;
        } else if (field === 'amount') {
          const num = parseFloat(value || '0');
          newItem.amount = isNaN(num) ? 0 : num;
        } else if (field === 'description') {
          newItem.description = value;
        }

        if (field === 'quantity' || field === 'unitValue') {
          newItem.amount = (newItem.quantity || 0) * (newItem.unitValue || 0);
        }

        return newItem;
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered.length === 0 ? [createEmptyItem()] : filtered;
    });
  };

  const invoiceTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // ---------------------------------------------------
  //      MODO NOTA FISCAL  (com parcelamento)
  // ---------------------------------------------------
  if (isInvoiceMode && !isEditingInstallment) {
    const validItems = items.filter(
      (item) =>
        item.description.trim() !== '' ||
        (!!item.amount && !isNaN(item.amount))
    );

    if (validItems.length === 0) {
      alert('Adicione pelo menos um item com descrição ou valor.');
      return;
    }

    const invoiceId = generateId(); // Mesmo ID para todos os itens
    const totalParc = installmentsCount; // total de parcelas
    const primeiraData = new Date(firstInstallmentDate + 'T00:00:00');

    validItems.forEach((item) => {
      const seriesId = generateId(); // série única POR ITEM da nota

      for (let p = 0; p < totalParc; p++) {
        const dataParcela = new Date(primeiraData);
        dataParcela.setMonth(dataParcela.getMonth() + p);

        const parcela: Transaction = {
          ...transaction,
          id: generateId(),
          date: dataParcela.toISOString().split("T")[0],
          accountNumber: item.accountNumber,
          accountName: item.accountName,
          description: `${item.description} (${p + 1}/${totalParc})`,
          quantity: item.quantity,
          unitValue: item.unitValue,
          amount: item.amount,
          invoiceId,
          seriesId,
        };

        const payload: SavePayload = {
          transaction: parcela,
          installmentsCount: 1, // parcelas já geradas aqui
        };

        onSave(payload);
      }
    });

    onClose();
    return;
  }

  // ---------------------------------------------------
  //      MODO SIMPLES  (como já existia)
  // ---------------------------------------------------
  const payload: SavePayload = {
    transaction: {
      ...transaction,
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

  const canUseInvoiceMode = !isEditingInstallment;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {transactionToEdit ? 'Editar' : 'Adicionar'} Lançamento
          </h2>

          <label className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isInvoiceMode}
              onChange={(e) => {
                if (!canUseInvoiceMode) return;
                const enabled = e.target.checked;
                setIsInvoiceMode(enabled);
                if (enabled) {
                  setItems([
                    {
                      id: generateId(),
                      accountNumber: transaction.accountNumber,
                      accountName: transaction.accountName,
                      description: transaction.description,
                      quantity: transaction.quantity ?? 1,
                      unitValue: transaction.unitValue ?? 0,
                      amount:
                        (transaction.quantity ?? 1) *
                        (transaction.unitValue ?? 0),
                    },
                  ]);
                } else {
                  setItems([createEmptyItem()]);
                }
              }}
              className="mr-2"
              disabled={!canUseInvoiceMode}
            />
            Modo nota fiscal (vários itens)
          </label>
        </div>

        {isEditingInstallment && (
          <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-md space-y-3 mb-4">
            <div>
              <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                Esta é uma transação parcelada. Como deseja salvar as alterações?
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
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
                O modo nota fiscal fica desativado durante a edição de parcelas
                para evitar inconsistências.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cabeçalho comum */}
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

          {/* MODO SIMPLES */}
          {!isInvoiceMode && (
            <>
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
                        return { ...prev, description: newValue + suffix };
                      }
                      return { ...prev, description: newValue };
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
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
                    value={transaction.quantity}
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
                    value={transaction.unitValue}
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
            </>
          )}

          {/* MODO NOTA FISCAL */}
          {isInvoiceMode && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                Itens da nota fiscal
              </p>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left">Conta</th>
                      <th className="px-2 py-2 text-left">Histórico</th>
                      <th className="px-2 py-2 text-right">Quant.</th>
                      <th className="px-2 py-2 text-right">Vlr. Unit.</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-center">Remover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className="px-2 py-1">
                          <select
                            value={item.accountNumber}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'accountNumber',
                                e.target.value
                              )
                            }
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.number}>
                                {acc.number} - {acc.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'description',
                                e.target.value
                              )
                            }
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'quantity',
                                e.target.value
                              )
                            }
                            className="w-full text-right rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            value={item.unitValue}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'unitValue',
                                e.target.value
                              )
                            }
                            className="w-full text-right rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'amount',
                                e.target.value
                              )
                            }
                            className="w-full text-right rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white font-semibold"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 dark:text-red-400 text-xs sm:text-sm hover:underline"
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-800"
                >
                  + Adicionar item
                </button>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Total da nota:{' '}
                  {invoiceTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cada linha será salva como um lançamento separado, usando a mesma data,
                tipo e fornecedor/comprador.
              </p>
            </div>
          )}

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

          {!isInvoiceMode && (
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
                  min="1"
                  step="1"
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
                    onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {isInvoiceMode && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No modo nota fiscal, todos os itens são lançados à vista (1 parcela). Se
              precisar parcelar, use o modo simples.
            </p>
          )}

          {isEditingInstallment && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
              Alterar o número de parcelas irá recriar toda a série com os dados do
              formulário.
            </p>
          )}

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

export default EntryForm;
