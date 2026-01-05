import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Transaction,
    Account,
    RecurringTransaction,
    IrCategory,
    ReceiptStatus,
    isEntrada,
    isSaida,
    SavePayload,
} from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { syncService } from '../syncService';
import { cacheService } from '../cacheService';
import { useDebounce } from '../useDebounce';
import { usePagination } from '../usePagination';
import { usePersistedFilters } from '../usePersistedFilters';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { validateTransaction } from '../validation';
import { useToast } from '../Toast';
import {
    parseLocalDate,
    formatDateString,
    addMonths,
} from '../utils/formatters';
import { generateId } from '../utils/common';

export const useAppLogic = () => {
    const toast = useToast();

    // Estado de autenticação
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Dados
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [recurringTransactions, setRecurringTransactions] = useState<
        RecurringTransaction[]
    >([]);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(
        null
    );
    const [activeView, setActiveView] = useState<
        'list' | 'dashboard' | 'irpf' | 'cashflow'
    >('dashboard');
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Filtros persistidos
    const { filters, setFilters, clearFilters } = usePersistedFilters(
        user?.uid || 'guest'
    );

    // Debounce no termo de busca
    const debouncedSearchTerm = useDebounce(filters.searchTerm, 300);

    // Callback para recarregar do cache
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

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            if (!currentUser) {
                cacheService.clearMemoryCache();
            }
        });
        return () => unsubscribe();
    }, []);

    // Inicialização de dados
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
                } = await syncService.initialize(
                    user.uid,
                    reloadFromCache,
                    (active) => setIsBackgroundSyncing(active),
                    {
                        enableRealtimeListener: false,
                        transactionLimit: 150,
                        daysWindow: 90,
                    }
                );
                setTransactions(trans);
                setAccounts(acc.sort((a, b) => a.number - b.number));
                setRecurringTransactions(rec);
            } catch (error) {
                console.error('Erro ao inicializar dados:', error);
                toast.error('Erro ao carregar dados. Verifique sua conexão.');
            } finally {
                setDataLoading(false);
            }
        };

        initializeData();
        return () => syncService.cleanup();
    }, [user, reloadFromCache, toast]);

    // Realtime updates switcher
    useEffect(() => {
        if (!user) return;
        if (activeView === 'list') {
            syncService.enableRealtimeUpdates();
        } else {
            syncService.disableRealtimeUpdates();
        }
    }, [activeView, user]);

    // Filtros OTIMIZADOS
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const searchTermLower = debouncedSearchTerm.toLowerCase();

            const matchSearch =
                !debouncedSearchTerm ||
                t.description.toLowerCase().includes(searchTermLower) ||
                t.payee.toLowerCase().includes(searchTermLower) ||
                t.accountName.toLowerCase().includes(searchTermLower) ||
                t.amount.toString().includes(searchTermLower);

            const matchType = !filters.type || t.type === filters.type;
            const matchAccount =
                !filters.accountId || t.accountNumber === parseInt(filters.accountId);
            const matchDate =
                (!filters.startDate || t.date >= filters.startDate) &&
                (!filters.endDate || t.date <= filters.endDate);

            return matchSearch && matchType && matchAccount && matchDate;
        });
    }, [
        transactions,
        debouncedSearchTerm,
        filters.type,
        filters.accountId,
        filters.startDate,
        filters.endDate,
    ]);

    // Transações para gráficos/totais (exclui Conta Titi por padrão)
    const chartTransactions = useMemo(() => {
        return filteredTransactions.filter(t =>
            !t.isContaTiti || filters.includeContaTiti
        );
    }, [filteredTransactions, filters.includeContaTiti]);

    // Ordenação (mantemos todos na lista)
    const sortedTransactions = useMemo(() => {
        const sorted = [...filteredTransactions].sort((a, b) =>
            a.date.localeCompare(b.date)
        );
        return sortOrder === 'asc' ? sorted : sorted.reverse();
    }, [filteredTransactions, sortOrder]);

    // Paginação
    const pagination = usePagination(sortedTransactions, { initialPageSize: 50 });

    // Totais (usando chartTransactions)
    const { totalEntradas, totalSaidas, margem } = useMemo(() => {
        let entradas = 0,
            saidas = 0;
        for (const t of chartTransactions) {
            if (isEntrada(t)) entradas += t.amount;
            else if (isSaida(t)) saidas += t.amount;
        }
        return {
            totalEntradas: entradas,
            totalSaidas: saidas,
            margem: entradas - saidas,
        };
    }, [chartTransactions]);

    // IRPF resumo
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
                const atual = porCategoria.get(key) || {
                    categoria: key,
                    total: 0,
                    count: 0,
                };
                atual.total += t.amount;
                atual.count += 1;
                porCategoria.set(key, atual);
            }

            const precisaRecibo =
                isRelevante &&
                isSaida(t) &&
                t.receiptStatus !== ReceiptStatus.ATTACHED &&
                t.receiptStatus !== ReceiptStatus.NOT_REQUIRED;

            if (precisaRecibo) pendentesComprovante.push(t);
        });

        return {
            resumoArray: Array.from(porCategoria.values()).sort(
                (a, b) => b.total - a.total
            ),
            pendentesComprovante,
        };
    }, [filteredTransactions]);

    // Invoice groups
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

    // Handlers
    const handleSignOut = useCallback(async () => {
        syncService.cleanup();
        cacheService.clearMemoryCache();
        await signOut(auth);
    }, []);

    const handleForceSync = useCallback(async () => {
        if (!user || isSyncing) return;
        setIsSyncing(true);
        try {
            const {
                transactions: trans,
                accounts: acc,
                recurringTransactions: rec,
                throttled,
            } = await syncService.forceFullSync(user.uid, {
                transactionLimit: 200,
                daysWindow: 120,
            });

            setTransactions(trans);
            setAccounts(acc.sort((a, b) => a.number - b.number));
            setRecurringTransactions(rec);

            if (throttled) {
                toast.info('Sincronização muito frequente. Aguarde uns instantes.');
            } else {
                toast.success('Dados sincronizados!');
            }
        } catch (error: any) {
            console.error('Erro ao sincronizar:', error);
            toast.error('Erro ao sincronizar. Tente novamente.');
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSyncing, toast]);

    const handleLoadMore = useCallback(async () => {
        if (!user || isLoadingMore) return;

        // Encontrar a data da transação mais antiga carregada
        // Assumindo que transactions pode não estar ordenada por data no array cru,
        // mas syncService.loadOlderTransactions precisa de uma data de corte.
        // Vamos achar a menor data do array atual.
        const timestamps = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
        if (timestamps.length === 0) return;

        const minTimestamp = Math.min(...timestamps);
        const oldestDate = new Date(minTimestamp).toISOString().split('T')[0];

        setIsLoadingMore(true);
        try {
            const olderTransactions = await syncService.loadOlderTransactions(user.uid, oldestDate);
            if (olderTransactions.length > 0) {
                setTransactions(prev => {
                    // Merge evitando duplicatas (embora o service já faça, aqui é state local)
                    const existingIds = new Set(prev.map(t => t.id));
                    const uniqueNew = olderTransactions.filter(t => !existingIds.has(t.id));
                    return [...prev, ...uniqueNew];
                });
                toast.success(`${olderTransactions.length} lançamentos antigos carregados.`);
            } else {
                toast.info('Não há mais lançamentos para carregar.');
            }
        } catch (error) {
            console.error('Erro ao carregar mais:', error);
            toast.error('Erro ao carregar histórico.');
        } finally {
            setIsLoadingMore(false);
        }
    }, [user, transactions, isLoadingMore, toast]);

    const handleAddTransaction = useCallback(() => {
        setTransactionToEdit(null);
        setIsFormOpen(true);
    }, []);

    const handleEditTransaction = useCallback((transaction: Transaction) => {
        setTransactionToEdit(transaction);
        setIsFormOpen(true);
    }, []);

    const handleDeleteTransactions = useCallback(
        async (ids: string[], deleteSeries: boolean = false) => {
            if (!user || ids.length === 0) return;

            try {
                let idsToDelete = [...ids];

                if (deleteSeries) {
                    // Encontra todos os seriesIds envolvidos nos itens selecionados
                    const seriesIds = new Set<string>();
                    ids.forEach((id) => {
                        const t = transactions.find((tr) => tr.id === id);
                        if (t?.seriesId) seriesIds.add(t.seriesId);
                    });

                    // Se houver séries envolvidas, busca todos os itens dessas séries
                    if (seriesIds.size > 0) {
                        const relatedTransactions = transactions.filter(
                            (t) => t.seriesId && seriesIds.has(t.seriesId)
                        );
                        const relatedIds = relatedTransactions.map((t) => t.id);

                        // Merge com ids originais (Set para evitar duplicatas)
                        idsToDelete = Array.from(new Set([...idsToDelete, ...relatedIds]));
                    }
                }

                await syncService.deleteTransactionsBatch(idsToDelete, user.uid);

                // Atualiza estado local
                setTransactions((prev) => prev.filter((t) => !idsToDelete.includes(t.id)));

                toast.success(
                    idsToDelete.length > 1
                        ? `${idsToDelete.length} lançamentos excluídos!`
                        : 'Lançamento excluído!'
                );
            } catch (error) {
                console.error('Erro ao excluir:', error);
                toast.error('Erro ao excluir.');
            }
        },
        [user, transactions, toast]
    );

    const handleSaveTransaction = useCallback(
        async (payload: SavePayload) => {
            if (!user) return;
            const {
                transaction,
                installmentsCount = 1,
                firstInstallmentDate,
                updateScope = 'single',
            } = payload;

            // Validação
            const validation = validateTransaction(transaction, transactions);
            if (!validation.isValid) {
                toast.error(validation.errors[0]?.message || 'Dados inválidos');
                return;
            }
            if (validation.warnings.length > 0) {
                const proceed = window.confirm(
                    `Avisos:\n${validation.warnings
                        .map((w) => `• ${w.message}`)
                        .join('\n')}\n\nDeseja continuar?`
                );
                if (!proceed) return;
            }

            try {
                const transactionsToSave: Transaction[] = [];
                const transactionsToDelete: string[] = [];

                if (transactionToEdit) {
                    transactionsToSave.push({ ...transaction, id: transactionToEdit.id });
                } else {
                    if (installmentsCount > 1) {
                        const startDate = parseLocalDate(
                            firstInstallmentDate || transaction.date
                        );
                        const seriesId = generateId();

                        // Calcular valor das parcelas
                        const totalCents = Math.round(transaction.amount * 100);
                        const basePerInstallment = Math.floor(totalCents / installmentsCount);
                        const remainder = totalCents - (basePerInstallment * installmentsCount);

                        for (let i = 0; i < installmentsCount; i++) {
                            const installmentDate = addMonths(startDate, i);

                            let cents = basePerInstallment;
                            if (i === installmentsCount - 1) {
                                cents += remainder;
                            }
                            const installmentAmount = cents / 100;

                            transactionsToSave.push({
                                ...transaction,
                                id: generateId(),
                                seriesId,
                                date: formatDateString(installmentDate),
                                description: `${transaction.description} (${i + 1}/${installmentsCount})`,
                                amount: installmentAmount,
                            });
                        }
                    } else {
                        transactionsToSave.push({ ...transaction, id: generateId() });
                    }
                }

                if (transactionsToDelete.length > 0) {
                    await syncService.deleteTransactionsBatch(
                        transactionsToDelete,
                        user.uid
                    );
                }
                if (transactionsToSave.length > 0) {
                    await syncService.saveTransactionsBatch(transactionsToSave, user.uid);
                }

                setTransactions((prev) => {
                    let updated = prev.filter((t) => !transactionsToDelete.includes(t.id));
                    transactionsToSave.forEach((newTrans) => {
                        const idx = updated.findIndex((t) => t.id === newTrans.id);
                        if (idx >= 0) updated[idx] = newTrans;
                        else updated.push(newTrans);
                    });
                    return updated;
                });

                setTransactionToEdit(null);
                toast.success(transactionToEdit ? 'Atualizado!' : 'Salvo!');
            } catch (error) {
                console.error('Erro ao salvar:', error);
                toast.error('Erro ao salvar.');
            }
        },
        [user, transactionToEdit, transactions, toast]
    );

    const handleGenerateRecurring = useCallback(
        async (year: number, month: number) => {
            if (!user) return;

            const existingSignatures = new Set(
                transactions
                    .filter((t) => {
                        const tDate = parseLocalDate(t.date);
                        return tDate.getFullYear() === year && tDate.getMonth() === month - 1;
                    })
                    .map(
                        (t) =>
                            `${parseLocalDate(t.date).getDate()}-${t.accountNumber}-${t.amount
                            }-${t.description}`
                    )
            );

            const newTransactions: Transaction[] = [];
            recurringTransactions.forEach((rt) => {
                const daysInMonth = new Date(year, month, 0).getDate();
                const day = Math.min(rt.dayOfMonth, daysInMonth);

                const transactionDate = new Date(
                    year,
                    month - 1,
                    day,
                    12,
                    0,
                    0
                );

                // Use clamped day for signature check to match what is saved
                const signature = `${day}-${rt.accountNumber}-${rt.amount}-${rt.description}`;
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
                            irCategory: rt.irCategory,
                        });
                    }
                }
            });

            if (newTransactions.length > 0) {
                await syncService.saveTransactionsBatch(newTransactions, user.uid);
                setTransactions((prev) => [...prev, ...newTransactions]);
                toast.success(`${newTransactions.length} lançamento(s) gerado(s)!`);
            } else {
                toast.info('Nenhum novo lançamento para gerar.');
            }
        },
        [user, transactions, recurringTransactions, toast]
    );

    const handleSaveRecurring = useCallback(
        async (transaction: RecurringTransaction) => {
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
                toast.success('Conta fixa salva!');
            } catch (e) {
                console.error(e);
                toast.error('Erro ao salvar conta fixa.');
            }
        },
        [user, toast]
    );

    const handleDeleteRecurring = useCallback(
        async (id: string) => {
            if (!user) return;
            try {
                await syncService.deleteRecurringTransaction(id, user.uid);
                setRecurringTransactions((prev) => prev.filter((t) => t.id !== id));
                toast.success('Conta fixa excluída!');
            } catch (e) {
                console.error(e);
                toast.error('Erro ao excluir.');
            }
        },
        [user, toast]
    );

    const handleRestore = useCallback(
        async (data: {
            transactions: Transaction[];
            accounts: Account[];
            recurringTransactions: RecurringTransaction[];
        }) => {
            if (!user) return;

            // Salvar no Firebase
            await syncService.saveTransactionsBatch(data.transactions, user.uid);
            // Dummy call for accounts/others or generic restore logic

            setTransactions(data.transactions);
            setAccounts(data.accounts);
            setRecurringTransactions(data.recurringTransactions);
            toast.success('Backup restaurado (parcial - verifique sync)!');
        },
        [user, toast]
    );

    // Helper for keyboard shortcuts
    const shortcutHandlers = useMemo(
        () => ({
            onAddTransaction: handleAddTransaction,
            onToggleView: () => {
                setActiveView((prev) => {
                    const views: Array<'dashboard' | 'irpf' | 'list' | 'cashflow'> = [
                        'dashboard',
                        'irpf',
                        'list',
                        'cashflow',
                    ];
                    const idx = views.indexOf(prev);
                    return views[(idx + 1) % views.length];
                });
            },
            onOpenRecurring: () => setIsRecurringModalOpen(true),
            onExport: () => setIsExportModalOpen(true),
            onSync: handleForceSync,
            onEscape: () => {
                setIsFormOpen(false);
                setIsRecurringModalOpen(false);
                setIsExportModalOpen(false);
                setIsBackupModalOpen(false);
            },
        }),
        [handleAddTransaction, handleForceSync]
    );

    useKeyboardShortcuts(shortcutHandlers, !isFormOpen && !isRecurringModalOpen);

    return {
        user,
        authLoading,
        dataLoading,
        isSyncing,
        transactions,
        accounts,
        recurringTransactions,
        setRecurringTransactions,
        filteredTransactions,
        sortedTransactions,
        pagination,
        totalEntradas,
        totalSaidas,
        margem,
        invoiceGroups,
        irpfResumo,
        filters,
        setFilters,
        clearFilters,
        isFormOpen,
        setIsFormOpen,
        transactionToEdit,
        setTransactionToEdit,
        activeView,
        setActiveView,
        isRecurringModalOpen,
        setIsRecurringModalOpen,
        isExportModalOpen,
        setIsExportModalOpen,
        isBackupModalOpen,
        setIsBackupModalOpen,
        sortOrder,
        setSortOrder,
        handleSignOut,
        handleForceSync,
        handleAddTransaction,
        handleEditTransaction,
        handleDeleteTransactions,
        handleSaveTransaction,
        handleGenerateRecurring,
        handleSaveRecurring,
        handleDeleteRecurring,
        handleRestore,
        handleLoadMore,
        isLoadingMore,
        isBackgroundSyncing,
        chartTransactions,
    };
};
