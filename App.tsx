// === App.tsx CORRIGIDO ===
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Transaction,
  Account,
  RecurringTransaction,
  TransactionType,
  IrCategory,
  ReceiptStatus,
} from './types';
import EntryForm from './EntryForm';
import TransactionFilter from './TransactionFilter';
import RecurringTransactionsModal from './RecurringTransactionsModal';
import CustomChartView from './CustomChartView';
import ExportModal from './ExportModal';
import Login from './Login';
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  ChartBarIcon,
  ListIcon,
  CalendarIcon,
  DownloadIcon,
  RefreshIcon,
} from './Icons';

// Firebase Auth
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

// Serviço de Sincronização Otimizado
import { syncService } from './syncService';
import { cacheService } from './cacheService';

interface SavePayload {
  transaction: Transaction;
  installmentsCount?: number;
  firstInstallmentDate?: string;
  updateScope?: 'single' | 'future';
}

// Helper para gerar UUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// CORREÇÃO: Funções para manipulação de datas sem problemas de timezone
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringTransactions, setRecurringTransactions] =
    useState<RecurringTransaction[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] =
    useState<Transaction | null>(null);
  const [activeView, setActiveView] =
    useState<'list' | 'dashboard' | 'irpf'>('dashboard');
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    searchTerm: '',
    type: '',
    accountId: '',
    startDate: '',
    endDate: '',
  });

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const reloadFromCache = useCallback(async () => {
    if (!user) return;

    const [trans, acc, rec] = await Promise.all([
      cacheService.getTransactions(user.uid),
      cacheService.getAccounts(user.uid),
      cacheService.getRecurringTransactions(user.uid),
    ]);

    setTransactions(trans);
    setAccounts(acc.sort((a, b) => a.number - b.number));
    setRecurringTransactions(rec);
  }, [user]);

  // --- Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setAccounts([]);
      setRecurringTransactions([]);
      syncService.cleanup();
      return;
    }

    const initializeData = async () => {
      setDataLoading(true);
      try {
        const {
          transactions: trans,
          accounts: acc,
          recurringTransactions: rec,
        } = await syncService.initialize(user.uid, reloadFromCache);

        setTransactions(trans);
        setAccounts(acc.sort((a, b) => a.number - b.number));
        setRecurringTransactions(rec);
      } catch (error) {
        console.error('Erro ao inicializar dados:', error);
        alert(
          'Erro ao carregar os dados. Verifique sua conexão e tente novamente.'
        );
      } finally {
        setDataLoading(false);
      }
    };

    initializeData();

    return () => {
      syncService.cleanup();
    };
  }, [user, reloadFromCache]);

  const handleSignOut = async () => {
    syncService.cleanup();
    await signOut(auth);
  };

  const handleForceSync = async () => {
    if (!user || isSyncing) return;

    setIsSyncing(true);
    try {
      const {
        transactions: trans,
        accounts: acc,
        recurringTransactions: rec,
      } = await syncService.forceFullSync(user.uid);

      setTransactions(trans);
      setAccounts(acc.sort((a, b) => a.number - b.number));
      setRecurringTransactions(rec);
    } catch (error: any) {
      console.error('Erro ao sincronizar (detalhes):', error);

      const messageFromError =
        (error &&
          (error.message ||
            (typeof error === 'string' ? error : ''))) ||
        '';

      const extraHint =
        '\n\nDica: se a mensagem falar em "Missing or insufficient permissions", ' +
        'verifique as regras do Firestore (leitura/gravação para este usuário).';

      alert(
        `Erro ao sincronizar.\n\n${messageFromError || 'Tente novamente.'}${
          messageFromError ? extraHint : ''
        }`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const searchTermLower = filters.searchTerm.toLowerCase();
      const startDate = filters.startDate ? filters.startDate : null;
      const endDate = filters.endDate ? filters.endDate : null;

      const matchSearch = filters.searchTerm
        ? t.description.toLowerCase().includes(searchTermLower) ||
          t.payee.toLowerCase().includes(searchTermLower) ||
          t.accountName.toLowerCase().includes(searchTermLower) ||
          t.amount.toString().includes(searchTermLower)
        : true;

      const matchType = filters.type ? t.type === filters.type : true;
      const matchAccount = filters.accountId
        ? t.accountNumber === parseInt(filters.accountId)
        : true;
      
      // CORREÇÃO: Comparar datas como strings YYYY-MM-DD (evita timezone issues)
      const matchDate =
        (!startDate || t.date >= startDate) &&
        (!endDate || t.date <= endDate);

      return matchSearch && matchType && matchAccount && matchDate;
    });
  }, [transactions, filters]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    return sortOrder === 'asc' ? sorted : sorted.reverse();
  }, [filteredTransactions, sortOrder]);

  const { totalEntradas, totalSaidas, margem } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;

    for (const t of filteredTransactions) {
      const isEntrada =
        t.type === TransactionType.ENTRADA || t.type === 'Entrada';
      const isSaida =
        t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';

      if (isEntrada) {
        entradas += t.amount;
      } else if (isSaida) {
        saidas += t.amount;
      }
    }

    return {
      totalEntradas: entradas,
      totalSaidas: saidas,
      margem: entradas - saidas,
    };
  }, [filteredTransactions]);

  const irpfResumo = useMemo(() => {
    type CatKey = IrCategory | 'NAO_CLASSIFICADO';

    const porCategoria = new Map<
      CatKey,
      { categoria: CatKey; total: number; count: number }
    >();
    const pendentesComprovante: Transaction[] = [];

    filteredTransactions.forEach((t) => {
      const cat = (t.irCategory as IrCategory | undefined) ?? 'NAO_CLASSIFICADO';

      const isRelevante =
        t.irCategory && t.irCategory !== IrCategory.NAO_DEDUTIVEL;

      if (isRelevante) {
        const key = cat as CatKey;
        const atual =
          porCategoria.get(key) || { categoria: key, total: 0, count: 0 };
        atual.total += t.amount;
        atual.count += 1;
        porCategoria.set(key, atual);
      }

      const isSaida =
        t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';

      const precisaRecibo =
        isRelevante &&
        isSaida &&
        t.receiptStatus !== ReceiptStatus.ATTACHED &&
        t.receiptStatus !== ReceiptStatus.NOT_REQUIRED;

      if (precisaRecibo) {
        pendentesComprovante.push(t);
      }
    });

    const resumoArray = Array.from(porCategoria.values()).sort(
      (a, b) => b.total - a.total
    );

    return { resumoArray, pendentesComprovante };
  }, [filteredTransactions]);

  // Agrupar transações por invoiceId para exibição
  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    filteredTransactions.forEach((t) => {
      if (t.invoiceId) {
        const existing = groups.get(t.invoiceId) || [];
        existing.push(t);
        groups.set(t.invoiceId, existing);
      }
    });
    return groups;
  }, [filteredTransactions]);

  const handleAddTransaction = () => {
    setTransactionToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setIsFormOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    const transactionToDelete = transactions.find((t) => t.id === id);

    if (!transactionToDelete) {
      console.error('Transaction to delete not found');
      return;
    }

    try {
      if (transactionToDelete.seriesId) {
        const confirmMessage = `Este é um lançamento parcelado (${transactionToDelete.description}).\n\nClique em "OK" para excluir a série inteira.\nClique em "Cancelar" para excluir apenas esta parcela.`;
        if (window.confirm(confirmMessage)) {
          // Delete entire series
          const seriesTransactions = transactions.filter(
            (t) => t.seriesId === transactionToDelete.seriesId
          );
          const idsToDelete = seriesTransactions.map((t) => t.id);

          await syncService.deleteTransactionsBatch(idsToDelete, user.uid);
          setTransactions((prev) =>
            prev.filter(
              (t) => t.seriesId !== transactionToDelete.seriesId
            )
          );
        } else {
          // Delete only this one
          const seriesId = transactionToDelete.seriesId;
          const baseDescription =
            transactionToDelete.description.replace(
              /\s\(\d+\/\d+\)$/,
              ''
            );

          await syncService.deleteTransaction(id, user.uid);

          const remainingInstallments = transactions
            .filter(
              (t) => t.seriesId === seriesId && t.id !== id
            )
            .sort((a, b) => a.date.localeCompare(b.date));

          const updatedTransactions: Transaction[] =
            remainingInstallments.map((t, index) => ({
              ...t,
              description: `${baseDescription} (${
                index + 1
              }/${remainingInstallments.length})`,
            }));

          await syncService.saveTransactionsBatch(
            updatedTransactions,
            user.uid
          );

          setTransactions((prev) => {
            const withoutDeleted = prev.filter((t) => t.id !== id);
            return withoutDeleted.map((t) => {
              const updated = updatedTransactions.find(
                (u) => u.id === t.id
              );
              return updated || t;
            });
          });
        }
      } else {
        if (
          window.confirm(
            `Tem certeza que deseja excluir o lançamento: "${transactionToDelete.description}"?`
          )
        ) {
          await syncService.deleteTransaction(id, user.uid);
          setTransactions((prev) =>
            prev.filter((t) => t.id !== id)
          );
        }
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir transação.');
    }
  };

  const handleSaveTransaction = async (payload: SavePayload) => {
    if (!user) return;
    const {
      transaction,
      installmentsCount = 1,
      firstInstallmentDate,
      updateScope = 'single',
    } = payload;

    try {
      const transactionsToSave: Transaction[] = [];
      const transactionsToDelete: string[] = [];

      if (transactionToEdit) {
        const originalSeriesId = transactionToEdit.seriesId;
        const originalInstallmentsCount = originalSeriesId
          ? transactions.filter(
              (t) => t.seriesId === originalSeriesId
            ).length
          : 1;

        if (originalInstallmentsCount !== installmentsCount) {
          const toDelete = originalSeriesId
            ? transactions.filter(
                (t) => t.seriesId === originalSeriesId
              )
            : [transactionToEdit];

          transactionsToDelete.push(...toDelete.map((t) => t.id));

          let startDate: Date;
          if (originalSeriesId) {
            const seriesStart = transactions
              .filter((t) => t.seriesId === originalSeriesId)
              .sort((a, b) => a.date.localeCompare(b.date))[0];
            startDate = parseLocalDate(seriesStart.date);
          } else {
            startDate = parseLocalDate(transactionToEdit.date);
          }

          const baseDescription =
            transaction.description.replace(
              /\s\(\d+\/\d+\)$/,
              ''
            );

          if (installmentsCount > 1) {
            const newSeriesId = originalSeriesId || generateId();
            for (let i = 0; i < installmentsCount; i++) {
              const installmentDate = addMonths(startDate, i);
              transactionsToSave.push({
                ...transaction,
                id: generateId(),
                seriesId: newSeriesId,
                date: formatDateString(installmentDate),
                description: `${baseDescription} (${
                  i + 1
                }/${installmentsCount})`,
              });
            }
          } else {
            transactionsToSave.push({
              ...transaction,
              id: transactionToEdit.id,
              seriesId: undefined,
              date: formatDateString(startDate),
              description: baseDescription,
            });
          }
        } else {
          if (updateScope === 'future' && originalSeriesId) {
            const seriesTransactions = transactions
              .filter((t) => t.seriesId === originalSeriesId)
              .sort((a, b) => a.date.localeCompare(b.date));

            const editedIndex = seriesTransactions.findIndex(
              (t) => t.id === transactionToEdit.id
            );
            if (editedIndex === -1) return;

            const baseDescription =
              transaction.description.replace(
                /\s\(\d+\/\d+\)$/,
                ''
              );

            const baseDate = parseLocalDate(transaction.date);

            for (
              let i = editedIndex;
              i < seriesTransactions.length;
              i++
            ) {
              const originalInstallment = seriesTransactions[i];
              const newDate = addMonths(baseDate, i - editedIndex);

              const installmentNumberMatch =
                originalInstallment.description.match(
                  /\((\d+)\/\d+\)/
                );
              const installmentNumber =
                installmentNumberMatch
                  ? installmentNumberMatch[1]
                  : '';

              transactionsToSave.push({
                ...transaction,
                id: originalInstallment.id,
                seriesId: originalSeriesId,
                date: formatDateString(newDate),
                description: `${baseDescription} (${
                  installmentNumber
                }/${seriesTransactions.length})`,
              });
            }
          } else {
            transactionsToSave.push({
              ...transaction,
              id: transactionToEdit.id,
            });
          }
        }
      } else {
        if (installmentsCount > 1) {
          const startDate = parseLocalDate(
            firstInstallmentDate || transaction.date
          );
          const seriesId = generateId();

          for (let i = 0; i < installmentsCount; i++) {
            const installmentDate = addMonths(startDate, i);

            transactionsToSave.push({
              ...transaction,
              id: generateId(),
              seriesId: seriesId,
              date: formatDateString(installmentDate),
              description: `${transaction.description} (${
                i + 1
              }/${installmentsCount})`,
            });
          }
        } else {
          transactionsToSave.push({
            ...transaction,
            id: generateId(),
          });
        }
      }

      if (transactionsToDelete.length > 0) {
        await syncService.deleteTransactionsBatch(
          transactionsToDelete,
          user.uid
        );
      }

      if (transactionsToSave.length > 0) {
        await syncService.saveTransactionsBatch(
          transactionsToSave,
          user.uid
        );
      }

      setTransactions((prev) => {
        let updated = prev.filter(
          (t) => !transactionsToDelete.includes(t.id)
        );

        transactionsToSave.forEach((newTrans) => {
          const existingIndex = updated.findIndex(
            (t) => t.id === newTrans.id
          );
          if (existingIndex >= 0) {
            updated[existingIndex] = newTrans;
          } else {
            updated.push(newTrans);
          }
        });

        return updated;
      });

      setTransactionToEdit(null);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar transação.');
    }
  };

  const handleGenerateRecurring = async (year: number, month: number) => {
    if (!user) return;

    const existingSignatures = new Set(
      transactions
        .filter((t) => {
          const tDate = parseLocalDate(t.date);
          return tDate.getFullYear() === year && tDate.getMonth() === month - 1;
        })
        .map(
          (t) =>
            `${parseLocalDate(t.date).getDate()}-${t.accountNumber}-${
              t.amount
            }-${t.description}`
        )
    );

    const newTransactions: Transaction[] = [];

    recurringTransactions.forEach((rt) => {
      const transactionDate = new Date(year, month - 1, rt.dayOfMonth, 12, 0, 0);
      if (transactionDate.getMonth() === month - 1) {
        const signature = `${rt.dayOfMonth}-${rt.accountNumber}-${rt.amount}-${rt.description}`;
        if (!existingSignatures.has(signature)) {
          newTransactions.push({
            id: generateId(),
            date: formatDateString(transactionDate),
            type: rt.type,
            accountNumber: rt.accountNumber,
            accountName: rt.accountName,
            description: rt.description,
            amount: rt.amount,
            payee: rt.payee,
            paymentMethod: rt.paymentMethod,
          });
        }
      }
    });

    if (newTransactions.length > 0) {
      await syncService.saveTransactionsBatch(newTransactions, user.uid);
      setTransactions((prev) => [...prev, ...newTransactions]);
      alert(
        `${newTransactions.length} lançamento(s) recorrente(s) gerado(s) com sucesso!`
      );
    } else {
      alert('Nenhum novo lançamento recorrente para gerar neste mês.');
    }
  };

  const handleSaveRecurring = async (
    transaction: RecurringTransaction
  ) => {
    if (!user) return;
    try {
      const id = transaction.id || generateId();
      const fullTransaction = { ...transaction, id };

      await syncService.saveRecurringTransaction(fullTransaction, user.uid);

      setRecurringTransactions((prev) => {
        const existing = prev.findIndex((t) => t.id === id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = fullTransaction;
          return updated;
        }
        return [...prev, fullTransaction];
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!user) return;
    try {
      await syncService.deleteRecurringTransaction(id, user.uid);
      setRecurringTransactions((prev) =>
        prev.filter((t) => t.id !== id)
      );
    } catch (e) {
      console.error(e);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Formatar data para exibição (DD/MM/YYYY)
  const formatDisplayDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const receiptStatusLabel = (status?: ReceiptStatus) => {
    switch (status) {
      case ReceiptStatus.HAS_BUT_NOT_ATTACHED:
        return 'Tenho, mas não anexei';
      case ReceiptStatus.ATTACHED:
        return 'Comp. anexado';
      case ReceiptStatus.LOST:
        return 'Perdi o comp.';
      case ReceiptStatus.NOT_REQUIRED:
        return 'Isento de comp.';
      case ReceiptStatus.NONE:
      default:
        return 's/ comprovante';
    }
  };

  const receiptStatusClasses = (status?: ReceiptStatus) => {
    switch (status) {
      case ReceiptStatus.ATTACHED:
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200';
      case ReceiptStatus.HAS_BUT_NOT_ATTACHED:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200';
      case ReceiptStatus.LOST:
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
      case ReceiptStatus.NOT_REQUIRED:
        return 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200';
      case ReceiptStatus.NONE:
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const irCategoryLabel = (cat?: IrCategory) => {
    switch (cat) {
      case IrCategory.SAUDE:
        return 'Saúde';
      case IrCategory.EDUCACAO:
        return 'Educação';
      case IrCategory.LIVRO_CAIXA:
        return 'Livro caixa';
      case IrCategory.CARNE_LEAO:
        return 'Carnê-Leão';
      case IrCategory.ALUGUEL:
        return 'Aluguel';
      case IrCategory.BEM_DIREITO:
        return 'Bens e direitos';
      case IrCategory.ATIVIDADE_RURAL:
        return 'Atividade Rural';
      case IrCategory.OUTRA:
        return 'Outra';
      case IrCategory.NAO_DEDUTIVEL:
        return 'Não dedutível / geral';
      default:
        return 'Não classificado';
    }
  };

  // Verificar se uma transação é parte de uma nota fiscal
  const isInvoiceItem = (t: Transaction): boolean => {
    return !!t.invoiceId;
  };

  // Obter cor de fundo para linha da tabela baseado no invoiceId
  const getInvoiceRowClasses = (t: Transaction): string => {
    if (!t.invoiceId) return '';
    
    // Gerar cor consistente baseada no invoiceId
    const invoiceItems = invoiceGroups.get(t.invoiceId);
    if (!invoiceItems || invoiceItems.length <= 1) return '';
    
    return 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-400 dark:border-l-amber-600';
  };


  // --- Renderização ---
  if (authLoading)
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">
        Carregando...
      </div>
    );
  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          <div className="flex w-full sm:w-auto justify-between items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
              Livro Caixa
            </h1>
            <button
              onClick={handleSignOut}
              className="sm:hidden text-xs text-gray-500 dark:text-gray-400 hover:text-red-500"
            >
              Sair
            </button>
          </div>

          <div className="flex items-center w-full sm:w-auto justify-around sm:justify-end sm:space-x-2">
            <button
              onClick={handleSignOut}
              className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 mr-4"
            >
              Sair
            </button>

            {/* Botão de Sync */}
            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              className={`p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 ${
                isSyncing ? 'animate-spin' : ''
              }`}
              aria-label="Sincronizar dados"
              title="Sincronizar dados"
            >
              <RefreshIcon className="w-6 h-6" />
            </button>

            {/* Exportar */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Exportar para Excel"
            >
              <DownloadIcon className="w-6 h-6" />
            </button>

            {/* Dashboard */}
            <button
              onClick={() => setActiveView('dashboard')}
              className={`p-2 rounded-md ${
                activeView === 'dashboard'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-label="Dashboard"
            >
              <ChartBarIcon className="w-6 h-6" />
            </button>

            {/* IRPF */}
            <button
              onClick={() => setActiveView('irpf')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                activeView === 'irpf'
                  ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-label="Visão IRPF"
            >
              IRPF
            </button>

            {/* Lista */}
            <button
              onClick={() => setActiveView('list')}
              className={`p-2 rounded-md ${
                activeView === 'list'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-label="Lista de Transações"
            >
              <ListIcon className="w-6 h-6" />
            </button>

            <button
              onClick={() => setIsRecurringModalOpen(true)}
              className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-md shadow hover:bg-gray-700"
              title="Contas Fixas"
            >
              <CalendarIcon className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">Contas Fixas</span>
            </button>
            <button
              onClick={handleAddTransaction}
              className="flex items-center bg-indigo-600 text-white px-3 py-2 rounded-md shadow hover:bg-indigo-700"
              title="Adicionar Lançamento"
            >
              <PlusIcon className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {dataLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-500">
              Carregando dados...
            </span>
          </div>
        ) : (
          <>
            <TransactionFilter
              filters={filters}
              onFilterChange={setFilters}
              accounts={accounts}
            />

            {activeView === 'dashboard' && (
              <div className="space-y-4 mt-4">
                {/* Cards de resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Entradas
                    </p>
                    <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalEntradas)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Saídas
                    </p>
                    <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(totalSaidas)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Margem
                    </p>
                    <p
                      className={`mt-2 text-2xl font-bold ${
                        margem >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(margem)}
                    </p>
                  </div>
                </div>

                {/* Gráfico já existente */}
                <CustomChartView
                  transactions={filteredTransactions}
                  accounts={accounts}
                />
              </div>
            )}


            {activeView === 'list' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mt-4">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      Histórico de Lançamentos
                    </h2>
                    {/* Legenda para itens de nota fiscal */}
                    <div className="hidden sm:flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-block w-3 h-3 bg-amber-400 dark:bg-amber-600 rounded mr-1"></span>
                      Nota Fiscal
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSortOrder((prev) =>
                        prev === 'asc' ? 'desc' : 'asc'
                      )
                    }
                    className="text-xs text-gray-500 dark:text-gray-300"
                  >
                    Ordenar por data ({sortOrder === 'asc' ? '↑' : '↓'})
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Data
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Tipo
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Conta
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Histórico
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Fornecedor/Comprador
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Comprovante
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                          Categoria IR
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-300">
                          Valor
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-300">
                          Ações
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedTransactions.map((t) => (
                        <tr
                          key={t.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 ${getInvoiceRowClasses(t)}`}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                            <div className="flex items-center">
                              {isInvoiceItem(t) && (
                                <svg 
                                  className="w-4 h-4 mr-1.5 text-amber-500 dark:text-amber-400" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                  title="Item de Nota Fiscal"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              {formatDisplayDate(t.date)}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                t.type === 'Entrada' ||
                                t.type === TransactionType.ENTRADA
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                              }`}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                            {t.accountNumber} - {t.accountName}
                          </td>
                          <td className="px-4 py-2 text-gray-800 dark:text-gray-100">
                            {t.description}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                            {t.payee}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <span
                              className={
                                'inline-flex items-center px-2 py-0.5 rounded-full font-medium ' +
                                receiptStatusClasses(t.receiptStatus)
                              }
                            >
                              {receiptStatusLabel(t.receiptStatus)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                            {irCategoryLabel(t.irCategory as IrCategory | undefined)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleEditTransaction(t)}
                              className="inline-flex items-center p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-1"
                              title="Editar"
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="inline-flex items-center p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/60"
                              title="Excluir"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                      ))}

                      {sortedTransactions.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                          >
                            Nenhum lançamento encontrado com os filtros
                            atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'irpf' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mt-4 p-4 text-sm text-gray-700 dark:text-gray-200 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">
                    Resumo para Imposto de Renda
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Os valores abaixo consideram os mesmos filtros aplicados no topo
                    (data, tipo, conta, busca). Use os filtros para ver apenas um ano,
                    uma conta ou um tipo específico.
                  </p>
                </div>

                {/* Tabela 1: resumo por categoria fiscal */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    Totais por categoria fiscal
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/70">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Categoria
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-300">
                            Nº de lançamentos
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-300">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {irpfResumo.resumoArray.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400"
                            >
                              Nenhum lançamento relevante para IR com os filtros atuais.
                            </td>
                          </tr>
                        )}

                        {irpfResumo.resumoArray.map((row) => (
                          <tr key={row.categoria}>
                            <td className="px-3 py-2">
                              {row.categoria === 'NAO_CLASSIFICADO'
                                ? 'Não classificado'
                                : irCategoryLabel(row.categoria as IrCategory)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {row.count}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatCurrency(row.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabela 2: pendências de comprovante */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    Lançamentos com pendência de comprovante
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                    São mostrados aqui apenas lançamentos com categoria fiscal
                    diferente de &quot;Não dedutível&quot; em que o comprovante
                    não está marcado como &quot;comp. anexado&quot; nem
                    &quot;isento de comp.&quot;.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/70">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Data
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Conta
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Histórico
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Categoria IR
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300">
                            Comprovante
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-300">
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {irpfResumo.pendentesComprovante.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400"
                            >
                              Nenhuma pendência de comprovante com os filtros atuais.
                            </td>
                          </tr>
                        )}

                        {irpfResumo.pendentesComprovante.map((t) => (
                          <tr key={t.id}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatDisplayDate(t.date)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {t.accountNumber} - {t.accountName}
                            </td>
                            <td className="px-3 py-2">
                              {t.description}
                            </td>
                            <td className="px-3 py-2">
                              {irCategoryLabel(t.irCategory as IrCategory | undefined)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ' +
                                  receiptStatusClasses(t.receiptStatus)
                                }
                              >
                                {receiptStatusLabel(t.receiptStatus)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatCurrency(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </main>

      <EntryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveTransaction}
        transactionToEdit={transactionToEdit}
        accounts={accounts}
        transactions={transactions}
      />

      <RecurringTransactionsModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        accounts={accounts}
        recurringTransactions={recurringTransactions}
        setRecurringTransactions={setRecurringTransactions}
        onGenerate={handleGenerateRecurring}
        onSaveItem={handleSaveRecurring}
        onDeleteItem={handleDeleteRecurring}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transactions={filteredTransactions}
      />
    </div>
  );
};

export default App;