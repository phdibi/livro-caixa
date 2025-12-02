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

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitValue: number;
  amount: number;
  accountNumber: number;
  accountName: string;
}

// --------- HELPERS ---------
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
  // uso "any" aqui para não quebrar com campos extras que possam existir em Transaction
  const getInitialState = (): any => ({
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
    receiptStatus: ReceiptStatus.NAO_INFORMADO ?? 'NAO_INFORMADO',
    irCategory: IrCategory.NAO_DEDUTIVEL ?? 'NAO_DEDUTIVEL',
    irNotes: '',
    notes: '',
    // campos de parcelamento/controle
    isInstallment: false,
    installmentNumber: undefined,
    totalInstallments: undefined,
    seriesId: undefined,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createEmptyItem = (): InvoiceItem => ({
    id: generateId(),
    description: '',
    quantity: 1,
    unitValue: 0,
    amount: 0,
    accountNumber: accounts.length > 0 ? accounts[0].number : 0,
    accountName: accounts.length > 0 ? accounts[0].name : '',
  });

  const [transaction, setTransaction] = useState<any>(getInitialState());
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [updateScope, setUpdateScope] =
    useState<'single' | 'future'>('single');

  const [isInstallmentMode, setIsInstallmentMode] = useState(false);

  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([createEmptyItem()]);

  const isEditingInstallment = !!transactionToEdit?.seriesId;

  const canUseInvoiceMode = !isEditingInstallment;

  // --------- CARREGA REGISTRO EM EDIÇÃO ---------
  useEffect(() => {
    if (!isOpen) return;

    if (transactionToEdit) {
      const merged: any = {
        ...getInitialState(),
        ...transactionToEdit,
      };

      // se veio de uma série de parcelas
      if (transactionToEdit.seriesId) {
        const seriesTransactions = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        );
        setIsInstallmentMode(true);
        setInstallmentsCount(seriesTransactions.length || 1);

        // primeira data da série
        const sorted = [...seriesTransactions].sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0] ?? transactionToEdit;
        setFirstInstallmentDate(first.date);
      } else {
        setIsInstallmentMode(false);
        setInstallmentsCount(1);
        setFirstInstallmentDate(transactionToEdit.date);
      }

      // se por acaso você já tiver salvo itens em algum momento
      if ((transactionToEdit as any).items?.length) {
        const txItems = (transactionToEdit as any).items as any[];
        setIsInvoiceMode(true);
        setItems(
          txItems.map((it) => ({
            id: it.id || generateId(),
            description: it.description || '',
            quantity: it.quantity ?? 1,
            unitValue: it.unitValue ?? it.amount ?? 0,
            amount: it.amount ?? 0,
            accountNumber: it.accountNumber ?? merged.accountNumber,
            accountName: it.accountName ?? merged.accountName,
          }))
        );
      } else {
        setIsInvoiceMode(false);
        setItems([createEmptyItem()]);
      }

      setTransaction(merged);
    } else {
      setTransaction(getInitialState());
      setInstallmentsCount(1);
      setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
      setUpdateScope('single');
      setIsInstallmentMode(false);
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
    }
  }, [isOpen, transactionToEdit, transactions, accounts]);

  // --------- ATUALIZA TOTAL = QTDE * VLR UNITÁRIO ---------
  useEffect(() => {
    const qty = Number(transaction.quantity) || 0;
    const unit = Number(transaction.unitValue) || 0;

    if (document.activeElement?.getAttribute('name') !== 'amount') {
      setTransaction((prev: any) => ({
        ...prev,
        amount: qty * unit,
      }));
    }
  }, [transaction.quantity, transaction.unitValue]);

  if (!isOpen) return null;

  // --------- HANDLERS ---------
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === 'receiptStatus') {
      setTransaction((prev: any) => ({
        ...prev,
        receiptStatus: value as ReceiptStatus,
      }));
      return;
    }

    if (name === 'irCategory') {
      setTransaction((prev: any) => ({
        ...prev,
        irCategory: value as IrCategory,
      }));
      return;
    }

    if (name === 'accountNumber') {
      const num = parseInt(value, 10);
      const acc = accounts.find((a) => a.number === num);
      setTransaction((prev: any) => ({
        ...prev,
        accountNumber: num,
        accountName: acc?.name || '',
      }));
      return;
    }

    let numericValue: string | number = value;
    if (['amount', 'quantity', 'unitValue'].includes(name)) {
      numericValue = parseFloat(value) || 0;
    }

    setTransaction((prev: any) => ({
      ...prev,
      [name]: numericValue,
    }));
  };

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated: InvoiceItem = { ...item };

        switch (field) {
          case 'accountNumber': {
            const num =
              typeof value === 'string' ? parseInt(value, 10) : Number(value);
            const acc = accounts.find((a) => a.number === num);
            updated.accountNumber = num || 0;
            updated.accountName = acc?.name || '';
            break;
          }
          case 'quantity':
            updated.quantity = Number(value) || 0;
            break;
          case 'unitValue':
            updated.unitValue = Number(value) || 0;
            break;
          case 'amount':
            updated.amount = Number(value) || 0;
            break;
          case 'description':
            updated.description = String(value);
            break;
        }

        // se alterou qtde ou vlr unit, recalcula total do item
        if (field === 'quantity' || field === 'unitValue') {
          updated.amount = updated.quantity * updated.unitValue;
        }

        return updated;
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      return filtered.length === 0 ? [createEmptyItem()] : filtered;
    });
  };

  const resetForm = () => {
    setTransaction(getInitialState());
    setIsInstallmentMode(false);
    setInstallmentsCount(1);
    setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
    setIsInvoiceMode(false);
    setItems([createEmptyItem()]);
    setUpdateScope('single');
  };

  // --------- SUBMIT ---------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ----- MODO NOTA FISCAL -----
    if (isInvoiceMode) {
      const validItems = items.filter(
        (it) => it.description.trim() !== '' || it.amount > 0
      );

      if (validItems.length === 0) {
        alert('Adicione pelo menos um item na nota fiscal.');
        return;
      }

      const totalParc = isInstallmentMode
        ? Math.max(1, installmentsCount)
        : 1;

      const baseDateStr = isInstallmentMode
        ? firstInstallmentDate
        : transaction.date;

      const baseDate = new Date(baseDateStr + 'T00:00:00');
      const invoiceId = generateId();

      // Para cada item, dividimos o valor igualmente entre as parcelas
      validItems.forEach((item) => {
        const seriesId = totalParc > 1 ? generateId() : undefined;

        const totalCents = Math.round(item.amount * 100);
        const basePerInstallment = Math.floor(totalCents / totalParc);
        let remainder = totalCents - basePerInstallment * totalParc;

        for (let i = 0; i < totalParc; i++) {
          const d = new Date(baseDate);
          d.setMonth(baseDate.getMonth() + i);

          let cents = basePerInstallment;
          if (i === totalParc - 1) {
            cents += remainder;
          }
          const amount = cents / 100;

          const parcela: Transaction = {
            ...(transaction as Transaction),
            id: generateId(),
            date: d.toISOString().split('T')[0],
            accountNumber: item.accountNumber,
            accountName: item.accountName,
            description:
              totalParc > 1
                ? `${item.description || transaction.description} (${
                    i + 1
                  }/${totalParc})`
                : item.description || transaction.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount,
            // marca como parcela
            isInstallment: totalParc > 1,
            installmentNumber: totalParc > 1 ? i + 1 : undefined,
            totalInstallments: totalParc > 1 ? totalParc : undefined,
            seriesId,
            // agrupa as parcelas da mesma NF
            invoiceId: invoiceId as any,
          };

          // importante: installmentsCount = 1, para o App não parcelar de novo
          onSave({
            transaction: parcela,
            installmentsCount: 1,
          });
        }
      });

      onClose();
      resetForm();
      return;
    }

    // ----- MODO NORMAL (SEM NOTA FISCAL) -----
    if (!transaction.accountNumber) {
      alert('Selecione uma conta.');
      return;
    }

    if (!String(transaction.description || '').trim()) {
      alert('Informe uma descrição.');
      return;
    }

    if (!transaction.amount || transaction.amount === 0) {
      alert('O valor não pode ser zero.');
      return;
    }

    const txDate = new Date(transaction.date + 'T00:00:00');

    const baseTransaction: Transaction = {
      ...(transaction as Transaction),
      date: txDate.toISOString().split('T')[0],
      year: txDate.getFullYear(),
      month: txDate.getMonth() + 1,
      updatedAt: new Date().toISOString(),
      isInstallment: isInstallmentMode,
      installmentNumber: isInstallmentMode
        ? transaction.installmentNumber
        : undefined,
      totalInstallments: isInstallmentMode ? installmentsCount : undefined,
    };

    const payload: SavePayload = {
      transaction: {
        ...baseTransaction,
        id: transactionToEdit?.id || generateId(),
      },
      updateScope: isEditingInstallment ? updateScope : undefined,
      installmentsCount: isInstallmentMode ? installmentsCount : undefined,
      firstInstallmentDate: isInstallmentMode
        ? firstInstallmentDate
        : undefined,
    };

    onSave(payload);
    onClose();
    resetForm();
  };

  const totalItemsAmount = items.reduce((sum, it) => sum + it.amount, 0);

  // --------- JSX ---------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start sm:items-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-4 sm:p-6 my-4 sm:my-8">
        {/* Cabeçalho */}
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
                setIsInvoiceMode(e.target.checked);
              }}
              disabled={!canUseInvoiceMode}
              className="mr-2"
            />
            Modo nota fiscal (vários itens)
          </label>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[80vh] overflow-y-auto pr-1"
        >
          {/* Tipo / Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo
              </label>
              <select
                name="type"
                value={transaction.type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value={TransactionType.ENTRADA}>Entrada</option>
                <option value={TransactionType.SAIDA}>Saída</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data
              </label>
              <input
                type="date"
                name="date"
                value={transaction.date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Conta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Conta
            </label>
            <select
              name="accountNumber"
              value={transaction.accountNumber}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.number}>
                  {acc.number} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição / Quantidade / Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descrição
            </label>
            <input
              type="text"
              name="description"
              value={transaction.description}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantidade
              </label>
              <input
                type="number"
                name="quantity"
                min={1}
                value={transaction.quantity}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Vlr. Unit.
              </label>
              <input
                type="number"
                step="0.01"
                name="unitValue"
                value={transaction.unitValue}
                onChange={handleChange}
                disabled={isInvoiceMode}
                className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                  isInvoiceMode
                    ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed'
                    : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Total
              </label>
              <input
                type="number"
                step="0.01"
                name="amount"
                value={transaction.amount}
                onChange={handleChange}
                disabled={isInvoiceMode}
                className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                  isInvoiceMode
                    ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed'
                    : ''
                }`}
              />
            </div>
          </div>

          {/* MODO NOTA FISCAL */}
          {isInvoiceMode && (
            <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Itens da Nota Fiscal
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs sm:text-sm hover:bg-indigo-700"
                >
                  + Adicionar Item
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Item {index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-xs text-red-500"
                        >
                          remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
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
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          {accounts.map((account) => (
                            <option
                              key={account.id}
                              value={account.number}
                            >
                              {account.number} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Descrição
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
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Qtde
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'quantity',
                              Number(e.target.value)
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Vlr. Unit.
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitValue}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'unitValue',
                              Number(e.target.value)
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
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
                              Number(e.target.value)
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total dos itens
                </span>
                <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                  R$ {totalItemsAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Histórico / Observações
            </label>
            <textarea
              name="notes"
              value={transaction.notes}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* IR / Comprovante (simplificado) */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Imposto de Renda
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Situação do comprovante
                </label>
                <select
                  name="receiptStatus"
                  value={transaction.receiptStatus}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="NAO_INFORMADO">Não informado</option>
                  <option value="POSSUI_COMPROVANTE">
                    Tenho a nota / comprovante
                  </option>
                  <option value="PERDEU_COMPROVANTE">
                    Tinha, mas perdi
                  </option>
                  <option value="ISENTO">Não é exigido (isento)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Categoria para IR
                </label>
                <select
                  name="irCategory"
                  value={transaction.irCategory}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="NAO_DEDUTIVEL">Não dedutível / Geral</option>
                  <option value="SAUDE">Saúde</option>
                  <option value="EDUCACAO">Educação</option>
                  <option value="PREVIDENCIA">Previdência</option>
                  <option value="ATIVIDADE_RURAL">Atividade rural</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Observações para IR (opcional)
              </label>
              <textarea
                name="irNotes"
                value={transaction.irNotes}
                onChange={handleChange}
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Parcelamento */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isInstallmentMode}
                onChange={(e) => setIsInstallmentMode(e.target.checked)}
                className="form-checkbox h-4 w-4 text-indigo-600"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Lançamento parcelado
              </label>
            </div>

            {isEditingInstallment && (
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Atualizar:
                </span>
                <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="updateScope"
                    value="single"
                    checked={updateScope === 'single'}
                    onChange={() => setUpdateScope('single')}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-1">Somente esta parcela</span>
                </label>
                <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="updateScope"
                    value="future"
                    checked={updateScope === 'future'}
                    onChange={() => setUpdateScope('future')}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-1">Esta e as futuras</span>
                </label>
              </div>
            )}
          </div>

          {isInstallmentMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Número de parcelas
                </label>
                <input
                  type="number"
                  min={1}
                  value={installmentsCount}
                  onChange={(e) =>
                    setInstallmentsCount(
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data da 1ª parcela
                </label>
                <input
                  type="date"
                  value={firstInstallmentDate}
                  onChange={(e) => setFirstInstallmentDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
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
