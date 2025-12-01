import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Transaction, Account, TransactionType, RecurringTransaction } from './types';
import EntryForm from './EntryForm';
import { GeminiAssistant } from './GeminiAssistant';
import TransactionFilter from './TransactionFilter';
import RecurringTransactionsModal from './RecurringTransactionsModal';
import CustomChartView from './CustomChartView';
import ExportModal from './ExportModal';
import Login from './Login';
import { PlusIcon, EditIcon, TrashIcon, ChartBarIcon, ListIcon, CalendarIcon, DownloadIcon, RefreshIcon } from './Icons';

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

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [activeView, setActiveView] = useState<'list' | 'dashboard'>('dashboard');
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    const [filters, setFilters] = useState({
        searchTerm: '',
        type: '',
        accountId: '',
        startDate: '',
        endDate: '',
    });

    // Callback para recarregar dados do cache quando houver mudanças
    const reloadFromCache = useCallback(async () => {
        if (!user) return;
        
        const [trans, acc, rec] = await Promise.all([
            cacheService.getTransactions(user.uid),
            cacheService.getAccounts(user.uid),
            cacheService.getRecurringTransactions(user.uid)
        ]);
        
        setTransactions(trans);
        setAccounts(acc.sort((a, b) => a.number - b.number));
        setRecurringTransactions(rec);
    }, [user]);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Inicialização com Sync Service
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
                // Carregar dados (do cache primeiro, depois sync em background)
                const { transactions: trans, accounts: acc, recurringTransactions: rec } = 
                    await syncService.initialize(user.uid, reloadFromCache);
                
                setTransactions(trans);
                setAccounts(acc.sort((a, b) => a.number - b.number));
                setRecurringTransactions(rec);
            } catch (error) {
                console.error('Erro ao inicializar dados:', error);
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

    // Sync manual forçado
    const handleForceSync = async () => {
        if (!user || isSyncing) return;
        
        setIsSyncing(true);
        try {
            const { transactions: trans, accounts: acc, recurringTransactions: rec } = 
                await syncService.forceFullSync(user.uid);
            
            setTransactions(trans);
            setAccounts(acc.sort((a, b) => a.number - b.number));
            setRecurringTransactions(rec);
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            alert('Erro ao sincronizar. Tente novamente.');
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const transactionDate = new Date(t.date);
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;

            if (startDate) startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(23, 59, 59, 999);

            const matchSearch = filters.searchTerm ?
                t.description.toLowerCase().includes(searchTermLower) ||
                t.payee.toLowerCase().includes(searchTermLower) ||
                t.accountName.toLowerCase().includes(searchTermLower) ||
                t.amount.toString().includes(searchTermLower)
                : true;

            const matchType = filters.type ? t.type === filters.type : true;
            const matchAccount = filters.accountId ? t.accountNumber === parseInt(filters.accountId) : true;
            const matchDate = (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);

            return matchSearch && matchType && matchAccount && matchDate;
        });
    }, [transactions, filters]);

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
        const transactionToDelete = transactions.find(t => t.id === id);

        if (!transactionToDelete) {
            console.error("Transaction to delete not found");
            return;
        }

        try {
            if (transactionToDelete.seriesId) {
                const confirmMessage = `Este é um lançamento parcelado (${transactionToDelete.description}).\n\nClique em "OK" para excluir a série inteira.\nClique em "Cancelar" para excluir apenas esta parcela.`;
                if (window.confirm(confirmMessage)) {
                    // Delete entire series
                    const seriesTransactions = transactions.filter(t => t.seriesId === transactionToDelete.seriesId);
                    const idsToDelete = seriesTransactions.map(t => t.id);
                    
                    await syncService.deleteTransactionsBatch(idsToDelete, user.uid);
                    setTransactions(prev => prev.filter(t => t.seriesId !== transactionToDelete.seriesId));
                } else {
                    // Delete one and renumber
                    const seriesId = transactionToDelete.seriesId;
                    const baseDescription = transactionToDelete.description.replace(/\s\(\d+\/\d+\)$/, '');
                    
                    await syncService.deleteTransaction(id, user.uid);

                    const remainingInstallments = transactions
                        .filter(t => t.seriesId === seriesId && t.id !== id)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    // Renumerar parcelas restantes
                    const updatedTransactions: Transaction[] = remainingInstallments.map((t, index) => ({
                        ...t,
                        description: `${baseDescription} (${index + 1}/${remainingInstallments.length})`
                    }));
                    
                    await syncService.saveTransactionsBatch(updatedTransactions, user.uid);
                    
                    setTransactions(prev => {
                        const withoutDeleted = prev.filter(t => t.id !== id);
                        return withoutDeleted.map(t => {
                            const updated = updatedTransactions.find(u => u.id === t.id);
                            return updated || t;
                        });
                    });
                }
            } else {
                if (window.confirm(`Tem certeza que deseja excluir o lançamento: "${transactionToDelete.description}"?`)) {
                    await syncService.deleteTransaction(id, user.uid);
                    setTransactions(prev => prev.filter(t => t.id !== id));
                }
            }
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir transação.");
        }
    };

    const handleSaveTransaction = async (payload: SavePayload) => {
        if (!user) return;
        const { transaction, installmentsCount = 1, firstInstallmentDate, updateScope = 'single' } = payload;

        try {
            const transactionsToSave: Transaction[] = [];
            const transactionsToDelete: string[] = [];

            if (transactionToEdit) {
                const originalSeriesId = transactionToEdit.seriesId;
                const originalInstallmentsCount = originalSeriesId 
                    ? transactions.filter(t => t.seriesId === originalSeriesId).length 
                    : 1;
                
                if (originalInstallmentsCount !== installmentsCount) {
                    // REGENERATION LOGIC
                    const toDelete = originalSeriesId
                        ? transactions.filter(t => t.seriesId === originalSeriesId)
                        : [transactionToEdit];
                    
                    transactionsToDelete.push(...toDelete.map(t => t.id));

                    let startDate;
                    if (originalSeriesId) {
                        const seriesStart = transactions
                            .filter(t => t.seriesId === originalSeriesId)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                        startDate = new Date(seriesStart.date + 'T00:00:00');
                    } else {
                        startDate = new Date(transactionToEdit.date + 'T00:00:00');
                    }

                    const baseDescription = transaction.description.replace(/\s\(\d+\/\d+\)$/, '');

                    if (installmentsCount > 1) {
                        const newSeriesId = originalSeriesId || generateId();
                        for (let i = 0; i < installmentsCount; i++) {
                            const installmentDate = new Date(startDate);
                            installmentDate.setMonth(startDate.getMonth() + i);
                            transactionsToSave.push({
                                ...transaction,
                                id: generateId(),
                                seriesId: newSeriesId,
                                date: installmentDate.toISOString().split('T')[0],
                                description: `${baseDescription} (${i + 1}/${installmentsCount})`,
                            });
                        }
                    } else {
                        transactionsToSave.push({
                            ...transaction,
                            id: transactionToEdit.id,
                            seriesId: undefined,
                            date: startDate.toISOString().split('T')[0],
                            description: baseDescription,
                        });
                    }
                } else {
                    // DATA UPDATE LOGIC
                    if (updateScope === 'future' && originalSeriesId) {
                        const seriesTransactions = transactions
                            .filter(t => t.seriesId === originalSeriesId)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                        const editedIndex = seriesTransactions.findIndex(t => t.id === transactionToEdit.id);
                        if (editedIndex === -1) return;

                        const baseDescription = transaction.description.replace(/\s\(\d+\/\d+\)$/, '');

                        for (let i = editedIndex; i < seriesTransactions.length; i++) {
                            const originalInstallment = seriesTransactions[i];
                            const newDate = new Date(transaction.date + 'T00:00:00');
                            newDate.setMonth(newDate.getMonth() + (i - editedIndex));

                            const installmentNumberMatch = originalInstallment.description.match(/\((\d+)\/\d+\)/);
                            const installmentNumber = installmentNumberMatch ? installmentNumberMatch[1] : '';
                            
                            transactionsToSave.push({
                                ...transaction,
                                id: originalInstallment.id,
                                seriesId: originalSeriesId,
                                date: newDate.toISOString().split('T')[0],
                                description: `${baseDescription} (${installmentNumber}/${seriesTransactions.length})`,
                            });
                        }
                    } else {
                        transactionsToSave.push({ ...transaction, id: transactionToEdit.id });
                    }
                }
            } else {
                // CREATE LOGIC
                if (installmentsCount > 1) {
                    const startDate = new Date((firstInstallmentDate || transaction.date) + 'T00:00:00');
                    const seriesId = generateId();

                    for (let i = 0; i < installmentsCount; i++) {
                        const installmentDate = new Date(startDate);
                        installmentDate.setMonth(startDate.getMonth() + i);
                        
                        transactionsToSave.push({
                            ...transaction,
                            id: generateId(),
                            seriesId: seriesId,
                            date: installmentDate.toISOString().split('T')[0],
                            description: `${transaction.description} (${i + 1}/${installmentsCount})`,
                        });
                    }
                } else {
                    transactionsToSave.push({ ...transaction, id: generateId() });
                }
            }

            // Executar operações
            if (transactionsToDelete.length > 0) {
                await syncService.deleteTransactionsBatch(transactionsToDelete, user.uid);
            }
            
            if (transactionsToSave.length > 0) {
                await syncService.saveTransactionsBatch(transactionsToSave, user.uid);
            }

            // Atualizar state local
            setTransactions(prev => {
                let updated = prev.filter(t => !transactionsToDelete.includes(t.id));
                
                transactionsToSave.forEach(newTrans => {
                    const existingIndex = updated.findIndex(t => t.id === newTrans.id);
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
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar transação.");
        }
    };
    
    const handleGenerateRecurring = async (year: number, month: number) => {
        if (!user) return;
        
        const existingSignatures = new Set(
            transactions
                .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date).getMonth() === month - 1)
                .map(t => `${new Date(t.date).getDate()}-${t.accountNumber}-${t.amount}-${t.description}`)
        );

        const newTransactions: Transaction[] = [];

        recurringTransactions.forEach(rt => {
            const transactionDate = new Date(year, month - 1, rt.dayOfMonth);
            if (transactionDate.getMonth() === month - 1) {
                const signature = `${rt.dayOfMonth}-${rt.accountNumber}-${rt.amount}-${rt.description}`;
                if (!existingSignatures.has(signature)) {
                    newTransactions.push({
                        id: generateId(),
                        date: transactionDate.toISOString().split('T')[0],
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
            setTransactions(prev => [...prev, ...newTransactions]);
            alert(`${newTransactions.length} lançamento(s) recorrente(s) gerado(s) com sucesso!`);
        } else {
            alert('Nenhum novo lançamento recorrente para gerar neste mês.');
        }
    };

    const handleAIParsedTransaction = async (parsedData: Partial<Transaction>) => {
        if (!user) return;
        
        const fullTransaction: Transaction = {
            id: generateId(),
            date: parsedData.date || new Date().toISOString().split('T')[0],
            type: parsedData.type || TransactionType.SAIDA,
            accountNumber: parsedData.accountNumber || 0,
            accountName: parsedData.accountName || 'Não especificada',
            description: parsedData.description || 'N/A',
            quantity: parsedData.quantity,
            unitValue: parsedData.unitValue,
            amount: parsedData.amount || 0,
            payee: parsedData.payee || 'N/A',
            paymentMethod: parsedData.paymentMethod || 'N/A',
        };
        
        try {
            await syncService.saveTransaction(fullTransaction, user.uid);
            setTransactions(prev => [...prev, fullTransaction]);
        } catch (e) {
            console.error("Erro AI:", e);
            alert("Erro ao salvar transação da IA.");
        }
    };
    
    const handleSaveRecurring = async (transaction: RecurringTransaction) => {
        if (!user) return;
        try {
            const id = transaction.id || generateId();
            const fullTransaction = { ...transaction, id };
            
            await syncService.saveRecurringTransaction(fullTransaction, user.uid);
            
            setRecurringTransactions(prev => {
                const existing = prev.findIndex(t => t.id === id);
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
            setRecurringTransactions(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const sortedTransactions = useMemo(() => {
        return [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredTransactions]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const totalEntradas = useMemo(() => filteredTransactions.filter(t => t.type === TransactionType.ENTRADA).reduce((acc, t) => acc + t.amount, 0), [filteredTransactions]);
    const totalSaidas = useMemo(() => filteredTransactions.filter(t => t.type === TransactionType.SAIDA).reduce((acc, t) => acc + t.amount, 0), [filteredTransactions]);
    const saldo = totalEntradas - totalSaidas;

    const DashboardView = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-gray-500 dark:text-gray-400">Total de Entradas</h3>
                    <p className="text-3xl font-bold text-green-500">{formatCurrency(totalEntradas)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-gray-500 dark:text-gray-400">Total de Saídas</h3>
                    <p className="text-3xl font-bold text-red-500">{formatCurrency(totalSaidas)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-gray-500 dark:text-gray-400">Saldo Atual</h3>
                    <p className={`text-3xl font-bold ${saldo >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>{formatCurrency(saldo)}</p>
                </div>
            </div>
            <CustomChartView 
                transactions={filteredTransactions} 
                accounts={accounts}
            />
        </div>
    );

    // -------- LISTVIEW COM DESTAQUE DE NOTA FISCAL --------
      // -------- LISTVIEW COM DESTAQUE DE NOTA FISCAL --------
  const ListView = () => {
    // Estatísticas por invoiceId
    type InvoiceStats = {
      transactionCount: number;
      itemKeys: Set<string>;
    };

    const invoiceStats: Record<string, InvoiceStats> = {};

    sortedTransactions.forEach((t) => {
      if (!t.invoiceId) return;

      if (!invoiceStats[t.invoiceId]) {
        invoiceStats[t.invoiceId] = {
          transactionCount: 0,
          itemKeys: new Set<string>(),
        };
      }

      const stats = invoiceStats[t.invoiceId];
      stats.transactionCount++;

      // Usamos seriesId quando existir (parcelas de um mesmo item)
      // senão, usamos combinação conta+descrição como "identidade" do item.
      const key = t.seriesId || `${t.accountNumber}-${t.description}`;
      stats.itemKeys.add(key);
    });

    const getInvoiceStats = (t: Transaction) =>
      t.invoiceId ? invoiceStats[t.invoiceId] : undefined;

    const isInInvoiceGroup = (t: Transaction) => {
      const stats = getInvoiceStats(t);
      return !!stats && stats.itemKeys.size > 1;
    };

    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Conta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Histórico
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedTransactions.map((t) => {
                const stats = getInvoiceStats(t);
                const inGroup = !!stats && stats.transactionCount > 1;
                const itemCount = stats ? stats.itemKeys.size : 1;
                const valueClass =
                  t.type === TransactionType.ENTRADA
                    ? 'text-green-500'
                    : 'text-red-500';

                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      inGroup
                        ? 'bg-indigo-50/70 dark:bg-indigo-900/40 border-l-4 border-indigo-400'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                      {new Date(t.date).toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {t.accountNumber} - {t.accountName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                      <div className="flex flex-col gap-1">
                        <span>{t.description}</span>
                        {t.payee && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t.payee}
                          </span>
                        )}
                        {inGroup && stats && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 w-fit">
                            NF com {itemCount} itens ({stats.transactionCount}{' '}
                            lanç.)
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${valueClass}`}
                    >
                      {t.type === TransactionType.SAIDA && '- '}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleEditTransaction(t)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                      >
                        <EditIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedTransactions.map((t) => {
              const stats = getInvoiceStats(t);
              const inGroup = !!stats && stats.transactionCount > 1;
              const itemCount = stats ? stats.itemKeys.size : 1;
              const valueClass =
                t.type === TransactionType.ENTRADA
                  ? 'text-green-500'
                  : 'text-red-500';

              return (
                <li
                  key={t.id}
                  className={`p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    inGroup
                      ? 'border-l-4 border-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/40'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(t.date).toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                      })}
                    </div>
                    <div className={`text-sm font-bold ${valueClass}`}>
                      {t.type === TransactionType.SAIDA && '- '}
                      {formatCurrency(t.amount)}
                    </div>
                  </div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {t.description}
                  </div>
                  {t.payee && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t.payee}
                    </div>
                  )}
                  {inGroup && stats && (
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        NF com {itemCount} itens ({stats.transactionCount} lanç.)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t.accountNumber} - {t.accountName}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleEditTransaction(t)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        <EditIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {sortedTransactions.length === 0 && (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Nenhum lançamento encontrado para os filtros selecionados.
          </p>
        )}
      </div>
    );
  };


    if (authLoading) return <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">Carregando...</div>;
    if (!user) return <Login />;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                    <div className="flex w-full sm:w-auto justify-between items-center">
                        <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">Livro Caixa</h1>
                        <button onClick={handleSignOut} className="sm:hidden text-xs text-gray-500 dark:text-gray-400 hover:text-red-500">
                            Sair
                        </button>
                    </div>
                    
                    <div className="flex items-center w-full sm:w-auto justify-around sm:justify-end sm:space-x-2">
                        <button onClick={handleSignOut} className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 mr-4">
                            Sair
                        </button>
                        {/* Botão de Sync */}
                        <button
                            onClick={handleForceSync}
                            disabled={isSyncing}
                            className={`p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 ${isSyncing ? 'animate-spin' : ''}`}
                            aria-label="Sincronizar dados"
                            title="Sincronizar dados"
                        >
                            <RefreshIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                            aria-label="Exportar para Excel"
                        >
                            <DownloadIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => setActiveView('dashboard')}
                            className={`p-2 rounded-md ${activeView === 'dashboard' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            aria-label="Dashboard"
                        >
                            <ChartBarIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => setActiveView('list')}
                            className={`p-2 rounded-md ${activeView === 'list' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            aria-label="Lista de Transações"
                        >
                            <ListIcon className="w-6 h-6" />
                        </button>
                        <button 
                            onClick={() => setIsRecurringModalOpen(true)}
                            className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-md shadow hover:bg-gray-700"
                            title="Contas Fixas"
                        >
                            <CalendarIcon className="w-5 h-5 sm:mr-2"/>
                            <span className="hidden sm:inline">Contas Fixas</span>
                        </button>
                        <button 
                            onClick={handleAddTransaction} 
                            className="flex items-center bg-indigo-600 text-white px-3 py-2 rounded-md shadow hover:bg-indigo-700"
                            title="Adicionar Lançamento"
                        >
                            <PlusIcon className="w-5 h-5 sm:mr-2"/>
                            <span className="hidden sm:inline">Adicionar</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {dataLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 text-gray-500">Carregando dados...</span>
                    </div>
                ) : (
                    <>
                        <TransactionFilter filters={filters} onFilterChange={setFilters} accounts={accounts} />
                        {activeView === 'dashboard' ? <DashboardView /> : <ListView />}
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
            <GeminiAssistant onTransactionParsed={handleAIParsedTransaction} accounts={accounts} />
        </div>
    );
};

export default App;
