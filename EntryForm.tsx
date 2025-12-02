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
  accountNumber: string;
  accountName: string;
}

const EntryForm: React.FC<EntryFormProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionToEdit,
  accounts,
  transactions,
}) => {
  const [transaction, setTransaction] = useState<Transaction>({
    id: '',
    description: '',
    type: 'expense',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    accountNumber: '',
    accountName: '',
    category: '',
    subcategory: '',
    payee: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    quantity: 1,
    unitValue: 0,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    isInstallment: false,
    installmentNumber: undefined,
    totalInstallments: undefined,
    seriesId: undefined,
    irRelevant: false,
    irCategory: 'NAO_DEDUTIVEL',
    receiptStatus: 'NAO_INFORMADO',
    irNotes: '',
    irReceiptNumber: '',
    irServiceType: '',
    irProviderType: 'PESSOA_FISICA',
    irProviderId: '',
    irProviderName: '',
  });

  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [updateScope, setUpdateScope] = useState<'single' | 'future'>('single');
  const [isInstallmentMode, setIsInstallmentMode] = useState(false);

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
        receiptStatus: transactionToEdit.receiptStatus || 'NAO_INFORMADO',
        irCategory: transactionToEdit.irCategory || 'NAO_DEDUTIVEL',
        irProviderType: transactionToEdit.irProviderType || 'PESSOA_FISICA',
      });

      if (transactionToEdit.isInstallment && transactionToEdit.seriesId) {
        setIsInstallmentMode(true);

        const seriesTransactions = transactions.filter(
          (t) => t.seriesId === transactionToEdit.seriesId
        );
        const totalInstallments =
          transactionToEdit.totalInstallments || seriesTransactions.length;

        setInstallmentsCount(totalInstallments);

        const firstTransaction = seriesTransactions.reduce((prev, curr) =>
          curr.installmentNumber && prev.installmentNumber
            ? curr.installmentNumber < prev.installmentNumber
              ? curr
              : prev
            : prev
        );

        setFirstInstallmentDate(
          firstTransaction.date || new Date().toISOString().split('T')[0]
        );
      } else {
        setIsInstallmentMode(false);
      }

      if (transactionToEdit.items && transactionToEdit.items.length > 0) {
        setIsInvoiceMode(true);
        setItems(
          transactionToEdit.items.map((item) => ({
            id: item.id || generateId(),
            description: item.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount: item.amount,
            accountNumber: item.accountNumber,
            accountName: item.accountName,
          }))
        );
      } else {
        setIsInvoiceMode(false);
        setItems([createEmptyItem()]);
      }
    } else {
      setTransaction((prev) => ({
        ...prev,
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        quantity: 1,
        unitValue: 0,
        isInstallment: false,
        installmentNumber: undefined,
        totalInstallments: undefined,
        seriesId: undefined,
        receiptStatus: 'NAO_INFORMADO',
        irCategory: 'NAO_DEDUTIVEL',
        irProviderType: 'PESSOA_FISICA',
      }));
      setInstallmentsCount(1);
      setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
      setUpdateScope('single');
      setIsInstallmentMode(false);
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
    }
  }, [isOpen, transactionToEdit, transactions]);

  useEffect(() => {
    if (!isInvoiceMode) return;

    const qty = transaction.quantity || 0;
    const unit = transaction.unitValue || 0;

    if (document.activeElement?.getAttribute('name') !== 'amount') {
      setTransaction((prev) => ({ ...prev, amount: qty * unit }));
    }
  }, [transaction.quantity, transaction.unitValue, isInvoiceMode]);

  if (!isOpen) return null;

  const handleChange = (
    field: keyof Transaction,
    value: string | number | boolean | IrCategory | ReceiptStatus
  ) => {
    let updatedValue: any = value;

    if (
      field === 'amount' ||
      field === 'quantity' ||
      field === 'unitValue'
    ) {
      const numericValue = parseFloat(value as string);
      updatedValue = isNaN(numericValue) ? 0 : numericValue;
    }

    if (field === 'irCategory') {
      const irCategoryValue = value as IrCategory;
      let irRelevant = false;

      switch (irCategoryValue) {
        case 'SAUDE':
        case 'EDUCACAO':
        case 'PREVIDENCIA':
        case 'DEPENDENTES':
        case 'OUTROS':
          irRelevant = true;
          break;
        default:
          irRelevant = false;
      }

      setTransaction((prev) => ({
        ...prev,
        irCategory: irCategoryValue,
        irRelevant,
      }));
      return;
    }

    if (field === 'receiptStatus') {
      const receiptStatusValue = value as ReceiptStatus;
      setTransaction((prev) => ({
        ...prev,
        receiptStatus: receiptStatusValue,
      }));
      return;
    }

    if (field === 'type') {
      const typeValue = value as TransactionType;
      setTransaction((prev) => ({
        ...prev,
        type: typeValue,
      }));
      return;
    }

    if (field === 'date') {
      const dateValue = value as string;
      const dateObj = new Date(dateValue);
      setTransaction((prev) => ({
        ...prev,
        date: dateValue,
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
      }));
      return;
    }

    if (field === 'accountNumber') {
      const account = accounts.find(
        (acc) => acc.number === Number(value)
      );
      setTransaction((prev) => ({
        ...prev,
        accountNumber: Number(value),
        accountName: account?.name || '',
      }));
      return;
    }

    setTransaction((prev) => ({
      ...prev,
      [field]: updatedValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isInvoiceMode) {
      const validItems = items.filter((item) => item.description.trim());

      if (validItems.length === 0) {
        alert('Adicione pelo menos um item na nota fiscal');
        return;
      }

      const totalAmount = validItems.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      const transactionDate = new Date(transaction.date);

      const payload: SavePayload = {
        transaction: {
          ...transaction,
          amount: totalAmount,
          year: transactionDate.getFullYear(),
          month: transactionDate.getMonth() + 1,
          updatedAt: new Date().toISOString(),
          items: validItems.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitValue: item.unitValue,
            amount: item.amount,
            accountNumber: Number(item.accountNumber),
            accountName: item.accountName,
          })),
        },
      };

      onSave(payload);
      onClose();
      resetForm();
      return;
    }

    if (!transaction.accountNumber) {
      alert('Selecione uma conta');
      return;
    }

    if (!transaction.description.trim()) {
      alert('Informe uma descrição');
      return;
    }

    if (transaction.amount === 0) {
      alert('O valor não pode ser zero');
      return;
    }

    const transactionDate = new Date(transaction.date);

    const payload: SavePayload = {
      transaction: {
        ...transaction,
        year: transactionDate.getFullYear(),
        month: transactionDate.getMonth() + 1,
        updatedAt: new Date().toISOString(),
        isInstallment: isInstallmentMode,
        installmentNumber: isInstallmentMode
          ? transaction.installmentNumber
          : undefined,
        totalInstallments: isInstallmentMode
          ? installmentsCount
          : undefined,
      },
      installmentsCount: isInstallmentMode ? installmentsCount : undefined,
      firstInstallmentDate: isInstallmentMode ? firstInstallmentDate : undefined,
      updateScope: isEditingInstallment ? updateScope : undefined,
    };

    onSave(payload);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setTransaction({
      id: '',
      description: '',
      type: 'expense',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      accountNumber: '',
      accountName: '',
      category: '',
      subcategory: '',
      payee: '',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      quantity: 1,
      unitValue: 0,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      isInstallment: false,
      installmentNumber: undefined,
      totalInstallments: undefined,
      seriesId: undefined,
      irRelevant: false,
      irCategory: 'NAO_DEDUTIVEL',
      receiptStatus: 'NAO_INFORMADO',
      irNotes: '',
      irReceiptNumber: '',
      irServiceType: '',
      irProviderType: 'PESSOA_FISICA',
      irProviderId: '',
      irProviderName: '',
    });
    setInstallmentsCount(1);
    setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
    setUpdateScope('single');
    setIsInstallmentMode(false);
    setIsInvoiceMode(false);
    setItems([createEmptyItem()]);
  };

  const handleInvoiceModeChange = (checked: boolean) => {
    if (checked) {
      setIsInvoiceMode(true);
      setIsInstallmentMode(false);
      setItems([createEmptyItem()]);
      setTransaction((prev) => ({
        ...prev,
        quantity: 1,
        unitValue: prev.amount,
      }));
    } else {
      setIsInvoiceMode(false);
      setItems([createEmptyItem()]);
      setTransaction((prev) => ({
        ...prev,
        items: [],
      }));
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updatedItem = { ...item };

        if (field === 'quantity' || field === 'unitValue' || field === 'amount') {
          const numericValue = parseFloat(value as string);
          (updatedItem as any)[field] = isNaN(numericValue) ? 0 : numericValue;
        } else {
          (updatedItem as any)[field] = value;
        }

        if (field === 'quantity' || field === 'unitValue') {
          updatedItem.amount = updatedItem.quantity * updatedItem.unitValue;
        }

        if (field === 'accountNumber') {
          const account = accounts.find(
            (acc) => acc.number === Number(value)
          );
          updatedItem.accountName = account?.name || '';
        }

        return updatedItem;
      })
    );
  };

  const totalItemsAmount = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const canUseInvoiceMode =
    transaction.type === 'expense' && !isInstallmentMode;

  const IR_CATEGORIES: { value: IrCategory; label: string }[] = [
    { value: 'NAO_DEDUTIVEL', label: 'Não dedutível / Geral' },
    { value: 'SAUDE', label: 'Saúde' },
    { value: 'EDUCACAO', label: 'Educação' },
    { value: 'PREVIDENCIA', label: 'Previdência' },
    { value: 'DEPENDENTES', label: 'Dependentes' },
    { value: 'OUTROS', label: 'Outros gastos dedutíveis' },
  ];

  const RECEIPT_STATUS_OPTIONS: { value: ReceiptStatus; label: string }[] = [
    { value: 'TENHO_NOTA', label: 'Tenho a nota / comprovante' },
    { value: 'PERDI_NOTA', label: 'Tinha, mas perdi' },
    { value: 'NAO_EXIGIDO', label: 'Não é exigido (isento)' },
    { value: 'NAO_INFORMADO', label: 'Não informado' },
  ];

  function generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  function createEmptyItem(): InvoiceItem {
    return {
      id: generateId(),
      description: '',
      quantity: 1,
      unitValue: 0,
      amount: 0,
      accountNumber: '',
      accountName: '',
    };
  }

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
            Modo nota fiscal (vários itens)
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo
              </label>
              <select
                value={transaction.type}
                onChange={(e) =>
                  handleChange('type', e.target.value as TransactionType)
                }
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
                <option value="transfer">Transferência</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data
              </label>
              <input
                type="date"
                value={transaction.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Conta
            </label>
            <select
              value={transaction.accountNumber}
              onChange={(e) =>
                handleChange('accountNumber', Number(e.target.value))
              }
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.number}>
                  {account.number} - {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Modo Nota Fiscal */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                IMPOSTO DE RENDA
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comprovante / Nota fiscal
                </p>
                <div className="space-y-2">
                  {RECEIPT_STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="radio"
                        name="receiptStatus"
                        value={option.value}
                        checked={transaction.receiptStatus === option.value}
                        onChange={(e) =>
                          handleChange(
                            'receiptStatus',
                            e.target.value as ReceiptStatus
                          )
                        }
                        className="form-radio text-indigo-600 mr-2"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria para IR
                </label>
                <select
                  value={transaction.irCategory}
                  onChange={(e) =>
                    handleChange('irCategory', e.target.value as IrCategory)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                >
                  {IR_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {transaction.irRelevant && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Dados do prestador (para recibo/nota)
                    </label>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <select
                          value={transaction.irProviderType}
                          onChange={(e) =>
                            handleChange(
                              'irProviderType',
                              e.target.value as 'PESSOA_FISICA' | 'PESSOA_JURIDICA'
                            )
                          }
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="PESSOA_FISICA">Pessoa física (CPF)</option>
                          <option value="PESSOA_JURIDICA">Pessoa jurídica (CNPJ)</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder={
                            transaction.irProviderType === 'PESSOA_FISICA'
                              ? 'CPF do prestador'
                              : 'CNPJ do prestador'
                          }
                          value={transaction.irProviderId || ''}
                          onChange={(e) =>
                            handleChange('irProviderId', e.target.value)
                          }
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Nome/Razão social do prestador"
                      value={transaction.irProviderName || ''}
                      onChange={(e) =>
                        handleChange('irProviderName', e.target.value)
                      }
                      className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Observações para IR (opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex.: nome do prestador, número da nota, procedimento, dependente relacionado, etc."
                      value={transaction.irNotes || ''}
                      onChange={(e) => handleChange('irNotes', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descrição
            </label>
            <input
              type="text"
              value={transaction.description}
              onChange={(e) => handleChange('description', e.target.value)}
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
                min="1"
                value={transaction.quantity ?? 1}
                onChange={(e) =>
                  handleChange('quantity', Number(e.target.value))
                }
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
                value={transaction.unitValue ?? 0}
                onChange={(e) =>
                  handleChange('unitValue', Number(e.target.value))
                }
                disabled={isInvoiceMode}
                className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                  isInvoiceMode ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
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
                onChange={(e) => handleChange('amount', Number(e.target.value))}
                disabled={isInvoiceMode}
                className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                  isInvoiceMode ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

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
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Descrição
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(item.id, 'description', e.target.value)
                          }
                          className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>

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
                          <option value="">Selecione uma conta</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.number}>
                              {account.number} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 dark:text-gray-300">
                          Qtde
                        </label>
                        <input
                          type="number"
                          min="1"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Histórico / Observações
            </label>
            <textarea
              value={transaction.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isInstallmentMode}
                onChange={(e) => {
                  setIsInstallmentMode(e.target.checked);
                  if (e.target.checked) {
                    setIsInvoiceMode(false);
                  }
                }}
                disabled={isInvoiceMode}
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
                  <span className="ml-2">Somente esta parcela</span>
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
                  <span className="ml-2">Esta e as futuras</span>
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
                  min="1"
                  value={installmentsCount}
                  onChange={(e) =>
                    setInstallmentsCount(Number(e.target.value))
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data da primeira parcela
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

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
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
