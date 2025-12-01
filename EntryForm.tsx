import React, { useState, useEffect } from 'react';
import {
  Transaction,
  TransactionType,
  Account,
  IrCategory,
  ReceiptStatus,
} from './types';

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
    // ----- CAMPOS NOVOS PARA IR -----
    receiptStatus: ReceiptStatus.NONE,
    irCategory: IrCategory.NAO_DEDUTIVEL,
    irNotes: '',
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
    if (!isOpen) return;

    if (transactionToEdit) {
      // Edição de lançamento existente
      setTransaction({
        ...transactionToEdit,
        quantity: transactionToEdit.quantity ?? 1,
        unitValue: transactionToEdit.unitValue ?? transactionToEdit.amount,
        // garantir defaults para registros antigos sem esses campos
        receiptStatus:
          transactionToEdit.receiptStatus ?? ReceiptStatus.NONE,
        irCategory:
          transactionToEdit.irCategory ?? IrCategory.NAO_DEDUTIVEL,
        irNotes: transactionToEdit.irNotes ?? '',
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

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
    } else if (name === 'receiptStatus') {
      setTransaction((prev) => ({
        ...prev,
        receiptStatus: value as ReceiptStatus,
      }));
    } else if (name === 'irCategory') {
      setTransaction((prev) => ({
        ...prev,
        irCategory: value as IrCategory,
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

  // -------- SUBMIT --------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ---------- MODO NOTA FISCAL (com ou sem parcelas) ----------
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

      const invoiceId = generateId();
      const totalParc = Math.max(1, installmentsCount);
      const primeiraData = new Date(firstInstallmentDate + 'T00:00:00');

      validItems.forEach((item) => {
        const seriesId = generateId(); // série única por item

        for (let p = 0; p < totalParc; p++) {
          const dataParcela = new Date(primeiraData);
          dataParcela.setMonth(dataParcela.getMonth() + p);

          const parcela: Transaction = {
            ...transaction,
            id: generateId(),
            date: dataParcela.toISOString().split('T')[0],
            accountNumber: item.accountNumber,
            accountName: item.accountName,
            description:
              totalParc > 1
                ? `${item.description} (${p + 1}/${totalParc})`
                : item.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount: item.amount,
            invoiceId,
            seriesId: totalParc > 1 ? seriesId : undefined,
          };

          const payload: SavePayload = {
            transaction: parcela,
            installmentsCount: 1, // já geramos todas as parcelas aqui
          };

          onSave(payload);
        }
      });

      onClose();
      return;
    }

    // ---------- MODO SIMPLES (igual antes) ----------
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
              <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="quantity"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Quantidade
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="quantity"
                    value={transaction.quantity ?? 1}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="unitValue"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Valor Unitário
                  </label>
                  <input
                    type="number"
                    step="0.01"
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
                    Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={transaction.amount}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
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
                  value={getBaseDescription(transaction.description)}
                  onChange={(e) => {
                    const base = getBaseDescription(transaction.description);
                    const newValue = e.target.value;
                    const suffix = transaction.description.slice(base.length);
                    setTransaction((prev) => ({
                      ...prev,
                      description: newValue + suffix,
                    }));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </>
          )}

          {/* MODO NOTA FISCAL - ITENS */}
          {isInvoiceMode && (
            <div className="space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium">
                  Itens da nota fiscal ({items.length})
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cada item pode ter uma conta diferente. O cabeçalho (tipo,
                  fornecedor, forma de pagamento, IR) será compartilhado entre os
                  itens.
                </p>
              </div>

              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2 bg-gray-50 dark:bg-gray-900/40"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Item
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Conta
                        </label>
                        <select
                          value={item.accountNumber}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'accountNumber',
                              e.target.value
                            )
                          }
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.number}>
                              {acc.number} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Histórico do item
                        </label>
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
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Qtde
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'quantity',
                              e.target.value
                            )
                          }
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Vlr unit.
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitValue}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'unitValue',
                              e.target.value
                            )
                          }
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Total
                        </label>
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
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  + Adicionar item
                </button>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Total NF: R$ {invoiceTotal.toFixed(2)}
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Observação geral da nota (opcional)
                </label>
                <input
                  type="text"
                  name="description"
                  value={getBaseDescription(transaction.description)}
                  onChange={(e) => {
                    const base = getBaseDescription(transaction.description);
                    const newValue = e.target.value;
                    const suffix = transaction.description.slice(base.length);
                    setTransaction((prev) => ({
                      ...prev,
                      description: newValue + suffix,
                    }));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Dados comuns (modo simples + NF) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="payee"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Fornecedor / Comprador
              </label>
              <input
                type="text"
                name="payee"
                value={transaction.payee}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="paymentMethod"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Forma de Pagamento
              </label>
              <select
                name="paymentMethod"
                value={transaction.paymentMethod}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* ----- BLOCO NOVO: CONTROLES DE IMPOSTO DE RENDA ----- */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Imposto de Renda
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
    Comprovante / Nota fiscal
  </label>

  <div className="mt-1 space-y-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">

    <label className="flex items-center">
      <input
        type="radio"
        name="receiptStatus"
        value={ReceiptStatus.HAS_BUT_NOT_ATTACHED}
        checked={transaction.receiptStatus === ReceiptStatus.HAS_BUT_NOT_ATTACHED}
        onChange={handleChange}
        className="form-radio text-indigo-600"
      />
      <span className="ml-2">Tenho a nota / comprovante</span>
    </label>

    <label className="flex items-center">
      <input
        type="radio"
        name="receiptStatus"
        value={ReceiptStatus.LOST}
        checked={transaction.receiptStatus === ReceiptStatus.LOST}
        onChange={handleChange}
        className="form-radio text-indigo-600"
      />
      <span className="ml-2">Tinha, mas perdi</span>
    </label>

    <label className="flex items-center">
      <input
        type="radio"
        name="receiptStatus"
        value={ReceiptStatus.NOT_REQUIRED}
        checked={transaction.receiptStatus === ReceiptStatus.NOT_REQUIRED}
        onChange={handleChange}
        className="form-radio text-indigo-600"
      />
      <span className="ml-2">Não é exigido (ex: isento)</span>
    </label>

    <label className="flex items-center">
      <input
        type="radio"
        name="receiptStatus"
        value={ReceiptStatus.NONE}
        checked={transaction.receiptStatus === ReceiptStatus.NONE}
        onChange={handleChange}
        className="form-radio text-indigo-600"
      />
      <span className="ml-2">Não informado</span>
    </label>

  </div>
</div>

              </div>

              <div>
                <label
                  htmlFor="irCategory"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Categoria para IR
                </label>
                <select
                  name="irCategory"
                  value={
                    transaction.irCategory ?? IrCategory.NAO_DEDUTIVEL
                  }
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value={IrCategory.NAO_DEDUTIVEL}>
                    Não dedutível / fora da declaração
                  </option>
                  <option value={IrCategory.LIVRO_CAIXA}>
                    Livro-caixa / atividade profissional
                  </option>
                  <option value={IrCategory.CARNE_LEAO}>
                    Carnê-leão / rendimentos PF
                  </option>
                  <option value={IrCategory.BENS_DIREITOS}>
                    Bens e direitos
                  </option>
                  <option value={IrCategory.DIVIDAS_ONUS}>
                    Dívidas e ônus
                  </option>
                  <option value={IrCategory.GANHO_CAPITAL}>
                    Ganho de capital
                  </option>
                  <option value={IrCategory.OUTROS}>Outros</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="irNotes"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Observações para IR (opcional)
              </label>
              <textarea
                name="irNotes"
                value={transaction.irNotes ?? ''}
                onChange={handleChange}
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                placeholder="Ex: CPF/CNPJ do prestador, número da nota, se é despesa dedutível, etc."
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Essas informações vão te ajudar a filtrar e somar apenas os
                lançamentos com comprovante válido na hora de gerar relatórios
                para o Imposto de Renda.
              </p>
            </div>
          </div>

          {/* CONTROLE DE PARCELAS – AGORA PARA OS DOIS MODOS */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Parcelamento
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="installmentsCount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Número de parcelas
                </label>
                <input
                  type="number"
                  min={1}
                  name="installmentsCount"
                  value={installmentsCount}
                  onChange={(e) =>
                    setInstallmentsCount(
                      Math.max(1, parseInt(e.target.value || '1', 10))
                    )
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="firstInstallmentDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Data da 1ª parcela
                </label>
                <input
                  type="date"
                  name="firstInstallmentDate"
                  value={firstInstallmentDate}
                  onChange={(e) => setFirstInstallmentDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Se você usar mais de 1 parcela no modo nota fiscal, serão criados
              vários lançamentos, um para cada parcela de cada item, já com
              descrição numerada (1/3, 2/3, ...).
            </p>
          </div>

          {/* BOTÕES */}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
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
