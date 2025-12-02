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

// CORREÇÃO: Função para criar data sem problemas de timezone
// Recebe string YYYY-MM-DD e retorna Date no horário local
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Meio-dia para evitar problemas de DST
};

// CORREÇÃO: Função para formatar data como YYYY-MM-DD sem timezone issues
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Função para adicionar meses a uma data
const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const EntryForm: React.FC<EntryFormProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionToEdit,
  accounts,
  transactions,
}) => {
  const getTodayString = (): string => {
    return formatDateString(new Date());
  };

  const getInitialState = (): Omit<Transaction, 'id'> => ({
    date: getTodayString(),
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
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(getTodayString());
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

      if (transactionToEdit.seriesId) {
        const seriesTransactions = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        );
        setInstallmentsCount(seriesTransactions.length || 1);

        const sorted = [...seriesTransactions].sort(
          (a, b) => a.date.localeCompare(b.date)
        );
        const first = sorted[0] ?? transactionToEdit;
        setFirstInstallmentDate(first.date);
      } else {
        setInstallmentsCount(1);
        setFirstInstallmentDate(transactionToEdit.date);
      }

      setTransaction(merged);

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
      const initial = getInitialState();
      setTransaction(initial);
      setInstallmentsCount(1);
      setFirstInstallmentDate(initial.date);
      setUpdateScope('single');
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
    }
  }, [isOpen, transactionToEdit, transactions, accounts]);

  // Atualiza total automático no modo simples
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

      // Data base segura para parcelamento ou à vista
      const baseDateString =
        installmentsCount > 1
          ? firstInstallmentDate || transaction.date
          : transaction.date;

      const safeBaseDateString =
        baseDateString || getTodayString();

      // CORREÇÃO: Usar parseLocalDate para evitar problemas de timezone
      const baseDate = parseLocalDate(safeBaseDateString);

      if (Number.isNaN(baseDate.getTime())) {
        alert(
          'Data da 1ª parcela inválida. Verifique o campo de data do lançamento.'
        );
        return;
      }

      validItems.forEach((item) => {
        const totalParc = Math.max(1, installmentsCount);
        const seriesId = totalParc > 1 ? generateId() : undefined;

        const rawAmount =
          typeof item.amount === 'number' && !isNaN(item.amount)
            ? item.amount
            : (item.quantity || 0) * (item.unitValue || 0);

        const totalCents = Math.round(rawAmount * 100);
        const basePerInstallment =
          totalParc > 0 ? Math.floor(totalCents / totalParc) : totalCents;
        let remainder = totalCents - basePerInstallment * totalParc;

        for (let i = 0; i < totalParc; i++) {
          // CORREÇÃO: Usar addMonths para adicionar meses corretamente
          const installmentDate = addMonths(baseDate, i);

          let cents = basePerInstallment;
          if (i === totalParc - 1) {
            cents += remainder;
          }
          const parcelaAmount = cents / 100;

          const parcelaBase: Transaction = {
            ...transaction,
            id: generateId(),
            date: formatDateString(installmentDate), // CORREÇÃO: Usar formatDateString
            accountNumber: item.accountNumber,
            accountName: item.accountName,
            description:
              totalParc > 1
                ? `${item.description} (${i + 1}/${totalParc})`
                : item.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount: parcelaAmount,
            invoiceId, // Marca como parte de uma nota fiscal
          };

          // Só adiciona seriesId quando de fato existir (parcelado > 1)
          const parcela: Transaction =
            totalParc > 1 && seriesId
              ? { ...parcelaBase, seriesId }
              : parcelaBase;

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
    
    // CORREÇÃO: Garantir que a data está correta antes de salvar
    const transactionToSave: Transaction = {
      ...transaction,
      id: transactionToEdit?.id || generateId(),
      date: transaction.date, // A data já está no formato YYYY-MM-DD
    };

    onSave({
      transaction: transactionToSave,
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

          {/* Fornecedor/Comprador - movido para cima para contexto da NF */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Fornecedor/Comprador
            </label>
            <input
              type="text"
              name="payee"
              value={transaction.payee}
              onChange={handleChange}
              placeholder="Nome do fornecedor ou comprador"
              className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {!isInvoiceMode && (
            <>
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
                  Histórico
                </label>
                <input
                  type="text"
                  name="description"
                  value={transaction.description}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </>
          )}

          {/* NF vs lançamento simples */}
          {isInvoiceMode ? (
            <>
              {/* ITENS DA NOTA */}
              <div className="border-2 border-amber-400 dark:border-amber-600 rounded-md p-3 bg-amber-50 dark:bg-amber-900/20 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Itens da Nota Fiscal
                  </p>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Total:{' '}
                    <strong>
                      {totalItemsAmount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>
                  </span>
                </div>

                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-md p-2 mb-2 bg-white dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Item {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300">
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
                        <label className="block text-xs text-gray-700 dark:text-gray-300">
                          Descrição do item
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
                          placeholder="Ex: Ração, Medicamento..."
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300">
                          Qtde
                        </label>
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
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300">
                          Valor unit.
                        </label>
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
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300">
                          Valor total
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={item.amount}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'amount',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-sm text-amber-700 dark:text-amber-400 hover:text-amber-900 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar item
                </button>
              </div>
            </>
          ) : (
            <>
              {/* MODO SIMPLES */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    Qtde
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    step="any"
                    value={transaction.quantity ?? 1}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    Valor unit.
                  </label>
                  <input
                    type="number"
                    name="unitValue"
                    step="any"
                    value={transaction.unitValue ?? 0}
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
                    step="0.01"
                    value={transaction.amount}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white font-semibold"
                  />
                </div>
              </div>
            </>
          )}

          {/* Dados de IR e comprovante */}
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
              Imposto de Renda / Comprovante
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300">
                  Situação do comprovante
                </label>
                <div className="mt-1 space-y-1 text-xs">
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
                      checked={
                        transaction.receiptStatus === ReceiptStatus.ATTACHED
                      }
                      onChange={handleChange}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">
                      Comprovante anexado
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300">
                  Categoria IR
                </label>
                <select
                  name="irCategory"
                  value={transaction.irCategory ?? IrCategory.NAO_DEDUTIVEL}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                >
                  <option value={IrCategory.NAO_DEDUTIVEL}>
                    Não dedutível / geral
                  </option>
                  <option value={IrCategory.SAUDE}>Saúde (dedutível)</option>
                  <option value={IrCategory.EDUCACAO}>
                    Educação (dedutível)
                  </option>
                  <option value={IrCategory.LIVRO_CAIXA}>
                    Livro caixa (autônomo)
                  </option>
                  <option value={IrCategory.CARNE_LEAO}>
                    Carnê Leão (autônomo)
                  </option>
                  <option value={IrCategory.ALUGUEL}>Aluguel</option>
                  <option value={IrCategory.BEM_DIREITO}>Bens e direitos</option>
                  <option value={IrCategory.ATIVIDADE_RURAL}>
                    Atividade Rural
                  </option>
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

          {/* Parcelamento */}
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

              {installmentsCount > 1 && (
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
              )}
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