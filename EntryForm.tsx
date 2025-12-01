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

  useEffect(() => {
    if (!isOpen) return;

    if (transactionToEdit) {
      setTransaction({
        ...transactionToEdit,
        quantity: transactionToEdit.quantity ?? 1,
        unitValue: transactionToEdit.unitValue ?? transactionToEdit.amount,
        receiptStatus: transactionToEdit.receiptStatus ?? ReceiptStatus.NONE,
        irCategory: transactionToEdit.irCategory ?? IrCategory.NAO_DEDUTIVEL,
        irNotes: transactionToEdit.irNotes ?? '',
      });

      setFirstInstallmentDate(transactionToEdit.date);
      setUpdateScope('single');
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);

      if (isEditingInstallment) {
        const totalSeries = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        ).length;
        setInstallmentsCount(totalSeries || 1);
      } else setInstallmentsCount(1);
    } else {
      const initial = getInitialState();
      setTransaction(initial);
      setInstallmentsCount(1);
      setFirstInstallmentDate(initial.date);
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
    }
  }, [isOpen, transactionToEdit, accounts, transactions, isEditingInstallment]);

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

    const numeric = ['amount', 'quantity', 'unitValue'].includes(name)
      ? parseFloat(value)
      : value;

    setTransaction((prev) => ({ ...prev, [name]: numeric }));
  };

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item };

        switch (field) {
          case 'accountNumber': {
            const num = parseInt(value, 10);
            const acc = accounts.find((a) => a.number === num);
            updated.accountNumber = num;
            updated.accountName = acc?.name || '';
            break;
          }
          case 'quantity':
            updated.quantity = parseFloat(value) || 0;
            break;
          case 'unitValue':
            updated.unitValue = parseFloat(value) || 0;
            break;
          case 'amount':
            updated.amount = parseFloat(value) || 0;
            break;
          case 'description':
            updated.description = value;
            break;
        }

        if (field === 'quantity' || field === 'unitValue') {
          updated.amount = updated.quantity * updated.unitValue;
        }

        return updated;
      })
    );
  };

  const handleAddItem = () => setItems((prev) => [...prev, createEmptyItem()]);

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const f = prev.filter((x) => x.id !== id);
      return f.length === 0 ? [createEmptyItem()] : f;
    });
  };

  const invoiceTotal = items.reduce((s, it) => s + it.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isInvoiceMode && !isEditingInstallment) {
      const validItems = items.filter(
        (i) => i.description.trim() !== '' || i.amount > 0
      );

      if (validItems.length === 0) {
        alert('Adicione pelo menos um item na nota.');
        return;
      }

      const invoiceId = generateId();
      const totalParc = Math.max(1, installmentsCount);
      const baseDate = new Date(firstInstallmentDate + 'T00:00:00');

      validItems.forEach((item) => {
        const seriesId = generateId();

        for (let i = 0; i < totalParc; i++) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);

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
            amount: item.amount,
            invoiceId,
            seriesId: totalParc > 1 ? seriesId : undefined,
          };

          onSave({
            transaction: parcela,
            installmentsCount: 1,
          });
        }
      });

      onClose();
      return;
    }

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
              onChange={(e) =>
                setIsInvoiceMode(e.target.checked && canUseInvoiceMode)
              }
              disabled={!canUseInvoiceMode}
              className="mr-2"
            />
            Modo nota fiscal
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                <option value={TransactionType.SAIDA}>Saída</option>
                <option value={TransactionType.ENTRADA}>Entrada</option>
              </select>
            </div>
          </div>

          {/* nota fiscal */}
          {isInvoiceMode && (
            <>
              <p className="font-semibold text-gray-700 dark:text-gray-200 text-sm pt-2">
                Itens da Nota Fiscal
              </p>

              <div className="space-y-4 max-h-80 overflow-y-auto">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2"
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">
                        Item
                      </span>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
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
                          value={it.accountNumber}
                          onChange={(e) =>
                            handleItemChange(
                              it.id,
                              'accountNumber',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.number}>
                              {a.number} - {a.name}
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
                          value={it.description}
                          onChange={(e) =>
                            handleItemChange(
                              it.id,
                              'description',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                          value={it.quantity}
                          onChange={(e) =>
                            handleItemChange(it.id, 'quantity', e.target.value)
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Vlr. Unit.
                        </label>
                        <input
                          type="number"
                          value={it.unitValue}
                          onChange={(e) =>
                            handleItemChange(
                              it.id,
                              'unitValue',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Total
                        </label>
                        <input
                          type="number"
                          value={it.amount}
                          onChange={(e) =>
                            handleItemChange(it.id, 'amount', e.target.value)
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs"
                >
                  + adicionar item
                </button>

                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Total NF: R$ {invoiceTotal.toFixed(2)}
                </span>
              </div>
            </>
          )}

          {/* modo simples */}
          {!isInvoiceMode && (
            <>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Conta
              </label>
              <select
                name="accountNumber"
                value={transaction.accountNumber}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.number}>
                    {a.number} - {a.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    Qtde
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

              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Histórico
              </label>
              <input
                type="text"
                name="description"
                value={getBaseDescription(transaction.description)}
                onChange={(e) => {
                  const base = getBaseDescription(transaction.description);
                  const newVal = e.target.value;
                  const suffix = transaction.description.slice(base.length);
                  setTransaction((prev) => ({
                    ...prev,
                    description: newVal + suffix,
                  }));
                }}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </>
          )}

          {/* fornecedor/pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Fornecedor / Comprador
              </label>
              <input
                type="text"
                name="payee"
                value={transaction.payee}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Forma de Pagamento
              </label>
              <select
                name="paymentMethod"
                value={transaction.paymentMethod}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="pix">Pix</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="debit_card">Cartão de Débito</option>
                <option value="cash">Dinheiro</option>
                <option value="transfer">Transferência</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>

          {/* imposto de renda */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
              Imposto de Renda
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                  Comprovante / Nota fiscal
                </label>

                <div className="mt-1 space-y-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
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
                      checked={
                        transaction.receiptStatus ===
                        ReceiptStatus.NOT_REQUIRED
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2">Não é exigido (isento)</span>
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

              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                  Categoria para IR
                </label>
                <select
                  name="irCategory"
                  value={transaction.irCategory}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value={IrCategory.NAO_DEDUTIVEL}>
                    Não dedutível / Geral
                  </option>
                  <option value={IrCategory.SAUDE}>Saúde</option>
                  <option value={IrCategory.EDUCACAO}>Educação</option>
                  <option value={IrCategory.LIVRO_CAIXA}>Livro-caixa</option>
                  <option value={IrCategory.CARNE_LEAO}>Carnê-Leão</option>
                  <option value={IrCategory.BENS_DIREITOS}>
                    Bens e direitos
                  </option>
                  <option value={IrCategory.DIVIDAS_ONUS}>
                    Dívidas e ônus
                  </option>
                  <option value={IrCategory.GANHO_CAPITAL}>
                    Ganho de capital
                  </option>
                  <option value={IrCategory.ATIVIDADE_RURAL}>Atividade Rural</option>
                  <option value={IrCategory.OUTROS}>Outros</option>
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

          {/* parcelas */}
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
