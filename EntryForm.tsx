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
    notes: '',
    receiptStatus: ReceiptStatus.NONE,
    irCategory: IrCategory.NAO_DEDUTIVEL,
    irNotes: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

  // Quando o modal abre / muda o registro em edição
  useEffect(() => {
    if (!isOpen) return;

    if (transactionToEdit) {
      const merged: Omit<Transaction, 'id'> = {
        ...getInitialState(),
        ...transactionToEdit,
      };

      // preencher parcela / recorrência
      if (transactionToEdit.seriesId) {
        const seriesTransactions = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        );
        setInstallmentsCount(seriesTransactions.length || 1);

        const sorted = [...seriesTransactions].sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0] ?? transactionToEdit;
        setFirstInstallmentDate(first.date);
      } else {
        setInstallmentsCount(1);
        setFirstInstallmentDate(transactionToEdit.date);
      }

      setTransaction(merged);

      // caso já existam itens salvos
      const anyItems = (transactionToEdit as any).items as
        | InvoiceItem[]
        | undefined;
      if (anyItems && anyItems.length > 0) {
        setIsInvoiceMode(true);
        setItems(
          anyItems.map((it) => ({
            id: it.id || generateId(),
            accountNumber: it.accountNumber,
            accountName: it.accountName,
            description: it.description,
            quantity: it.quantity,
            unitValue: it.unitValue,
            amount: it.amount,
          }))
        );
      } else {
        setIsInvoiceMode(false);
        setItems([createEmptyItem()]);
      }
    } else {
      setTransaction(getInitialState());
      setInstallmentsCount(1);
      setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
      setUpdateScope('single');
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
    }
  }, [isOpen, transactionToEdit, transactions, accounts]);

  // Atualiza total = quantidade * valor unitário (modo simples)
  useEffect(() => {
    if (isInvoiceMode) return;

    const qty = transaction.quantity || 0;
    const unit = transaction.unitValue || 0;

    if (document.activeElement?.getAttribute('name') !== 'amount') {
      setTransaction((prev) => ({ ...prev, amount: qty * unit }));
    }
  }, [transaction.quantity, transaction.unitValue, isInvoiceMode]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === 'accountNumber') {
      const num = parseInt(value, 10);
      const acc = accounts.find((a) => a.number === num);
      setTransaction((prev) => ({
        ...prev,
        accountNumber: num,
        accountName: acc?.name || '',
      }));
      return;
    }

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

    let numeric: string | number = value;
    if (['amount', 'quantity', 'unitValue'].includes(name)) {
      numeric = parseFloat(value) || 0;
    }

    setTransaction((prev) => ({ ...prev, [name]: numeric }));
  };

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item };

        switch (field) {
          case 'accountNumber': {
            const num = parseInt(value as string, 10);
            const acc = accounts.find((a) => a.number === num);
            updated.accountNumber = num;
            updated.accountName = acc?.name || '';
            break;
          }
          case 'quantity':
            updated.quantity = parseFloat(value as string) || 0;
            break;
          case 'unitValue':
            updated.unitValue = parseFloat(value as string) || 0;
            break;
          case 'amount':
            updated.amount = parseFloat(value as string) || 0;
            break;
          case 'description':
            updated.description = String(value);
            break;
        }

        if (field === 'quantity' || field === 'unitValue') {
          updated.amount = updated.quantity * updated.unitValue;
        }

        return updated;
      })
    );
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, createEmptyItem()]);

  const handleRemoveItem = (id: string) =>
    setItems((prev) =>
      prev.length === 1
        ? [createEmptyItem()]
        : prev.filter((item) => item.id !== id)
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // =========================
    // MODO NOTA FISCAL
    // =========================
    if (isInvoiceMode && !isEditingInstallment) {
      const validItems = items.filter(
        (i) => i.description.trim() !== '' || i.amount > 0
      );

      if (validItems.length === 0) {
        alert('Adicione pelo menos um item na nota.');
        return;
      }

      const invoiceId = generateId();
      const baseDate = new Date(firstInstallmentDate + 'T00:00:00');

      validItems.forEach((item) => {
        const totalParc = Math.max(1, installmentsCount);
        const seriesId = totalParc > 1 ? generateId() : undefined;

        const baseDateItem = new Date(baseDate);

        const rawAmount =
          typeof item.amount === 'number' && !isNaN(item.amount)
            ? item.amount
            : (item.quantity || 0) * (item.unitValue || 0);

        const totalCents = Math.round(rawAmount * 100);
        const basePerInstallment =
          totalParc > 0 ? Math.floor(totalCents / totalParc) : totalCents;
        let remainder = totalCents - basePerInstallment * totalParc;

        for (let i = 0; i < totalParc; i++) {
          const d = new Date(baseDateItem);
          d.setMonth(baseDateItem.getMonth() + i);

          let cents = basePerInstallment;
          if (i === totalParc - 1) {
            cents += remainder;
          }
          const parcelaAmount = cents / 100;

          const parcela: Transaction = {
            ...transaction,
            id: generateId(),
            date: d.toISOString().split('T')[0],
            accountNumber: item.accountNumber,
            accountName: item.accountName,
            description:
              totalParc > 1
                ? `${item.description} (${i + 1}/${totalParc})`
                : item.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount: parcelaAmount,
            invoiceId,
            seriesId,
          };

          onSave({
            transaction: parcela,
            // IMPORTANTÍSSIMO: 1 para o App NÃO re-parcelar
            installmentsCount: 1,
          });
        }
      });

      onClose();
      return;
    }

    // =========================
    // MODO NORMAL (sem nota fiscal)
    // =========================
    onSave({
      transaction: {
        ...transaction,
        id: transactionToEdit?.id || generateId(),
      },
      updateScope: isEditingInstallment ? updateScope : undefined,
      installmentsCount,
      firstInstallmentDate,
    });

    onClose();
  };

  const getBaseDescription = (d: string) =>
    d.replace(/\s\(\d+\/\d+\)$/, '');

  const canUseInvoiceMode = !isEditingInstallment;

  const totalItemsAmount = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start sm:items-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-4 sm:p-6 my-4 sm:my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {transactionToEdit ? 'Editar' : 'Adicionar'} Lançamento
          </h2>

          <label className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isInvoiceMode}
              onChange={(e) =>
                setIsInvoiceMode(e.target.checked && canUseInvoiceMode)
              }
              disabled={!canUseInvoiceMode}
              className="mr-2"
            />
            Modo nota fiscal
          </label>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[80vh] overflow-y-auto pr-1"
        >
          {/* dados comuns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Data
              </label>
              <input
                type="date"
                name="date"
                value={transaction.date}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Tipo
              </label>
              <select
                name="type"
                value={transaction.type}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value={TransactionType.ENTRADA}>Entrada</option>
                <option value={TransactionType.SAIDA}>Saída</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Conta
            </label>
            <select
              name="accountNumber"
              value={transaction.accountNumber}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.number}>
                  {account.number} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Descrição
            </label>
            <input
              type="text"
              name="description"
              value={transaction.description}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Quantidade
              </label>
              <input
                type="number"
                name="quantity"
                value={transaction.quantity}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Vlr. Unit.
              </label>
              <input
                type="number"
                name="unitValue"
                value={transaction.unitValue}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Total
              </label>
              <input
                type="number"
                name="amount"
                value={transaction.amount}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* MODO NOTA FISCAL */}
          {isInvoiceMode && (
            <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Itens da Nota Fiscal
                </p>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  + Adicionar Item
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-md p-3 bg-white dark:bg-gray-800 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Item {index + 1}
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
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'quantity',
                              e.target.value
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
                          value={item.unitValue}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'unitValue',
                              e.target.value
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
                          value={item.amount}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'amount',
                              e.target.value
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

          {/* histórico / observações */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Histórico / Observações
            </label>
            <textarea
              name="notes"
              value={transaction.notes ?? ''}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* imposto de renda */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
              Imposto de Renda
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                  Situação do comprovante
                </p>

                <div className="space-y-1">
                  <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="receiptStatus"
                      value={ReceiptStatus.HAS_RECEIPT}
                      checked={
                        transaction.receiptStatus ===
                        ReceiptStatus.HAS_RECEIPT
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2">Tenho a nota / comprovante</span>
                  </label>

                  <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="receiptStatus"
                      value={ReceiptStatus.LOST_RECEIPT}
                      checked={
                        transaction.receiptStatus ===
                        ReceiptStatus.LOST_RECEIPT
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2">Tinha, mas perdi</span>
                  </label>

                  <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="receiptStatus"
                      value={ReceiptStatus.NOT_REQUIRED}
                      checked={
                        transaction.receiptStatus ===
                        ReceiptStatus.NOT_REQUIRED
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2">Não é exigido (isento)</span>
                  </label>

                  <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="receiptStatus"
                      value={ReceiptStatus.NONE}
                      checked={
                        transaction.receiptStatus === ReceiptStatus.NONE
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2">Não informado</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                  Categoria para IR
                </label>
                <select
                  name="irCategory"
                  value={transaction.irCategory}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value={IrCategory.NAO_DEDUTIVEL}>
                                    Não dedutível / Geral
                    </option>
                  <option value={IrCategory.SAUDE}>Saúde</option>
                  <option value={IrCategory.EDUCACAO}>Educação</option>
                  <option value={IrCategory.LIVRO_CAIXA}>Livro-caixa</option>
                  <option value={IrCategory.CARNE_LEAO}>Carnê-Leão</option>
                  <option value={IrCategory.BENS_DIREITOS}>Bens e direitos</option>
                  <option value={IrCategory.ALUGUEL}>Aluguel</option>
                  <option value={IrCategory.ATIVIDADE_RURAL}>Atividade Rural</option>
                  <option value={IrCategory.OUTRA}>Outros</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-700 dark:text-gray-300">
                Observações para IR (opcional)
              </label>
              <textarea
                name="irNotes"
                value={transaction.irNotes ?? ''}
                onChange={handleChange}
                rows={2}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Ex.: nome do prestador, número da nota, vínculo com dependente..."
              />
            </div>
          </div>

          {/* Parcelamento (compartilhado com NF ou lançamento simples) */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
              Parcelamento
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Número de parcelas
                </label>
                <input
                  type="number"
                  value={installmentsCount}
                  onChange={(e) =>
                    setInstallmentsCount(
                      Math.max(1, parseInt(e.target.value || '1', 10))
                    )
                  }
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Data da 1ª parcela
                </label>
                <input
                  type="date"
                  value={firstInstallmentDate}
                  onChange={(e) => setFirstInstallmentDate(e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* botões */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
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
