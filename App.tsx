
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Account, TransactionType, RecurringTransaction } from './types';
import TransactionForm from './components/TransactionForm';
import { AiAssistant } from './components/AIAssistant';
import TransactionFilter from './components/TransactionFilter';
import RecurringTransactionsModal from './components/RecurringTransactionsModal';
import CustomChartView from './components/CustomChartView';
import ExportModal from './components/ExportModal';
import Login from './components/Login';
import { PlusIcon, EditIcon, TrashIcon, ChartBarIcon, ListIcon, CalendarIcon, DownloadIcon } from './components/Icons';

// Firebase Imports
import { auth, db } from './services/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    addDoc, 
    setDoc, 
    deleteDoc, 
    doc, 
    writeBatch, 
    getDocs 
} from 'firebase/firestore';

interface SavePayload {
    transaction: Transaction;
    installmentsCount?: number;
    firstInstallmentDate?: string;
    updateScope?: 'single' | 'future';
}

// Helper para gerar UUID seguro mesmo em HTTP (para testes mobile)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const initialAccounts: Account[] = [
    // Despesas
    { id: 'd1', number: 101, name: 'Sede', type: 'Despesa' },
    { id: 'd2', number: 102, name: 'Administrativas', type: 'Despesa' },
    { id: 'd3', number: 103, name: 'Pró-labore', type: 'Despesa' },
    { id: 'd4', number: 104, name: 'Assessoria', type: 'Despesa' },
    { id: 'd5', number: 105, name: 'Impostos', type: 'Despesa' },
    { id: 'd6', number: 106, name: 'Taxas', type: 'Despesa' },
    { id: 'd7', number: 107, name: 'Juros', type: 'Despesa' },
    { id: 'd8', number: 108, name: 'Folha de pagamento', type: 'Despesa' },
    { id: 'd9', number: 109, name: 'Encargos sociais', type: 'Despesa' },
    { id: 'd10', number: 110, name: 'Defensivos agricolas', type: 'Despesa' },
    { id: 'd11', number: 111, name: 'Serviços terceirizados', type: 'Despesa' },
    { id: 'd12', number: 112, name: 'Manutenções de maquinário', type: 'Despesa' },
    { id: 'd13', number: 113, name: 'Manutenções de instalações', type: 'Despesa' },
    { id: 'd14', number: 114, name: 'Combustíveis', type: 'Despesa' },
    { id: 'd15', number: 115, name: 'Arrendamentos', type: 'Despesa' },
    { id: 'd16', number: 116, name: 'Fretes', type: 'Despesa' },
    { id: 'd17', number: 117, name: 'Comissões', type: 'Despesa' },
    { id: 'd18', number: 118, name: 'Sanidade', type: 'Despesa' },
    { id: 'd19', number: 119, name: 'Reprodução', type: 'Despesa' },
    { id: 'd20', number: 120, name: 'Pastagens', type: 'Despesa' },
    { id: 'd21', number: 121, name: 'Suplementação', type: 'Despesa' },
    { id: 'd22', number: 122, name: 'Despesa Soja', type: 'Despesa' },
    { id: 'd23', number: 123, name: 'Mercado', type: 'Despesa' },
    { id: 'd24', number: 124, name: 'Outras despesas', type: 'Despesa' },
    { id: 'd25', number: 125, name: 'Cavalos', type: 'Despesa' },
    { id: 'd26', number: 126, name: 'Cães', type: 'Despesa' },
    { id: 'd27', number: 127, name: 'Suínos e Aves', type: 'Despesa' },
    { id: 'd28', number: 128, name: 'Veiculos Pessoais', type: 'Despesa' },
    { id: 'd29', number: 129, name: 'Exposições e eventos', type: 'Despesa' },
    { id: 'd30', number: 130, name: 'Ferragem', type: 'Despesa' },

    // Investimentos (categorizados como Despesa para fins de fluxo de caixa)
    { id: 'i1', number: 201, name: 'Touros reprodutores', type: 'Despesa' },
    { id: 'i2', number: 202, name: 'Novilhos recria', type: 'Despesa' },
    { id: 'i3', number: 203, name: 'Novilhas recria', type: 'Despesa' },
    { id: 'i4', number: 204, name: 'Novilhas prenhes', type: 'Despesa' },
    { id: 'i5', number: 205, name: 'Vacas de invernar', type: 'Despesa' },
    { id: 'i6', number: 206, name: 'Vacas prenhes', type: 'Despesa' },
    { id: 'i7', number: 207, name: 'Vacas reprodutoras', type: 'Despesa' },
    { id: 'i8', number: 208, name: 'Aquisição de Infra estrutura', type: 'Despesa' },
    { id: 'i9', number: 209, name: 'Aquisição de maquinários', type: 'Despesa' },
    { id: 'i10', number: 210, name: 'Aquisicao animal cavalar', type: 'Despesa' },

    // Receitas
    { id: 'r1', number: 301, name: 'Terneiros', type: 'Receita' },
    { id: 'r2', number: 302, name: 'Terneiras', type: 'Receita' },
    { id: 'r3', number: 303, name: 'Novilhos gordos', type: 'Receita' },
    { id: 'r4', number: 304, name: 'Novilhos recria', type: 'Receita' },
    { id: 'r5', number: 305, name: 'Novilhas gordas', type: 'Receita' },
    { id: 'r6', number: 306, name: 'Novilhas recria', type: 'Receita' },
    { id: 'r7', number: 307, name: 'Novilhas prenhes', type: 'Receita' },
    { id: 'r8', number: 308, name: 'Vacas de invernar', type: 'Receita' },
    { id: 'r9', number: 309, name: 'Vacas gordas', type: 'Receita' },
    { id: 'r10', number: 310, name: 'Vacas prenhes', type: 'Receita' },
    { id: 'r11', number: 311, name: 'Touros reprodução', type: 'Receita' },
    { id: 'r12', number: 312, name: 'Touros descarte', type: 'Receita' },
    { id: 'r13', number: 313, name: 'Arrendamentos', type: 'Receita' },
    { id: 'r14', number: 314, name: 'Soja', type: 'Receita' },
    { id: 'r15', number: 315, name: 'Arroz', type: 'Receita' },
    { id: 'r16', number: 316, name: 'Outras culturas', type: 'Receita' },
    { id: 'r17', number: 317, name: 'Outros produtos', type: 'Receita' },
    { id: 'r18', number: 318, name: 'Receita Financeira', type: 'Receita' },
    { id: 'r19', number: 319, name: 'Embrioes', type: 'Receita' },
];

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

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

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Firestore Listeners
    useEffect(() => {
        if (!user) {
            setTransactions([]);
            setAccounts([]);
            setRecurringTransactions([]);
            return;
        }

        // Transactions Listener
        const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.uid));
        const unsubTrans = onSnapshot(qTransactions, (snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(loaded);
        });

        // Accounts Listener (Seed if empty)
        const qAccounts = query(collection(db, 'accounts'), where('userId', '==', user.uid));
        const unsubAcc = onSnapshot(qAccounts, async (snapshot) => {
            if (snapshot.empty && snapshot.metadata.fromCache === false) {
                // Seed initial accounts
                const batch = writeBatch(db);
                initialAccounts.forEach(acc => {
                    const ref = doc(collection(db, 'accounts'));
                    batch.set(ref, { ...acc, userId: user.uid });
                });
                await batch.commit();
            } else {
                const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
                setAccounts(loaded.sort((a, b) => a.number - b.number));
            }
        });

        // Recurring Transactions Listener
        const qRecurring = query(collection(db, 'recurring_transactions'), where('userId', '==', user.uid));
        const unsubRec = onSnapshot(qRecurring, (snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTransaction));
            setRecurringTransactions(loaded);
        });

        return () => {
            unsubTrans();
            unsubAcc();
            unsubRec();
        };
    }, [user]);

    const handleSignOut = () => {
        signOut(auth);
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
                    const batch = writeBatch(db);
                    const seriesTransactions = transactions.filter(t => t.seriesId === transactionToDelete.seriesId);
                    seriesTransactions.forEach(t => {
                        batch.delete(doc(db, 'transactions', t.id));
                    });
                    await batch.commit();
                } else {
                    // Delete one and renumber
                    const seriesId = transactionToDelete.seriesId;
                    const baseDescription = transactionToDelete.description.replace(/\s\(\d+\/\d+\)$/, '');
                    
                    const batch = writeBatch(db);
                    batch.delete(doc(db, 'transactions', id));

                    const remainingInstallments = transactions
                        .filter(t => t.seriesId === seriesId && t.id !== id)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    remainingInstallments.forEach((t, index) => {
                        const newDesc = `${baseDescription} (${index + 1}/${remainingInstallments.length})`;
                        batch.update(doc(db, 'transactions', t.id), { description: newDesc });
                    });
                    await batch.commit();
                }
            } else {
                if (window.confirm(`Tem certeza que deseja excluir o lançamento: "${transactionToDelete.description}"?`)) {
                    await deleteDoc(doc(db, 'transactions', id));
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
            const batch = writeBatch(db);

            if (transactionToEdit) {
                const originalSeriesId = transactionToEdit.seriesId;
                const originalInstallmentsCount = originalSeriesId ? transactions.filter(t => t.seriesId === originalSeriesId).length : 1;
                
                if (originalInstallmentsCount !== installmentsCount) {
                    // REGENERATION LOGIC
                    // 1. Determine what to delete
                    const transactionsToDelete = originalSeriesId
                        ? transactions.filter(t => t.seriesId === originalSeriesId)
                        : [transactionToEdit];
                    
                    transactionsToDelete.forEach(t => {
                         batch.delete(doc(db, 'transactions', t.id));
                    });

                    // 2. Determine start date
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

                    // 3. Create new records
                    if (installmentsCount > 1) {
                        const newSeriesId = originalSeriesId || generateId();
                        for (let i = 0; i < installmentsCount; i++) {
                            const installmentDate = new Date(startDate);
                            installmentDate.setMonth(startDate.getMonth() + i);
                            const newId = generateId();
                            const newTrans = {
                                ...transaction,
                                id: newId,
                                seriesId: newSeriesId,
                                date: installmentDate.toISOString().split('T')[0],
                                description: `${baseDescription} (${i + 1}/${installmentsCount})`,
                                userId: user.uid
                            };
                            // Using setDoc with a new ID to ensure it's a new document
                            batch.set(doc(db, 'transactions', newId), newTrans);
                        }
                    } else { // Back to single
                         const newTrans = {
                            ...transaction,
                            id: transactionToEdit.id, // Keep original ID for single
                            seriesId: undefined, // Remove series ID explicitly
                            date: startDate.toISOString().split('T')[0],
                            description: baseDescription,
                            userId: user.uid
                        };
                        delete newTrans.seriesId; // Ensure property is gone
                        batch.set(doc(db, 'transactions', transactionToEdit.id), newTrans);
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
                            
                            const updatedFields = {
                                ...transaction,
                                date: newDate.toISOString().split('T')[0],
                                description: `${baseDescription} (${installmentNumber}/${seriesTransactions.length})`,
                                userId: user.uid
                            };
                            batch.update(doc(db, 'transactions', originalInstallment.id), updatedFields);
                        }
                    } else { // 'single' update
                        const { id, ...data } = transaction;
                        batch.update(doc(db, 'transactions', id), { ...data, userId: user.uid });
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
                        const newId = generateId();
                        
                        const newTrans = {
                            ...transaction,
                            id: newId,
                            seriesId: seriesId,
                            date: installmentDate.toISOString().split('T')[0],
                            description: `${transaction.description} (${i + 1}/${installmentsCount})`,
                            userId: user.uid
                        };
                        batch.set(doc(db, 'transactions', newId), newTrans);
                    }
                } else {
                    const newId = generateId();
                    batch.set(doc(db, 'transactions', newId), { ...transaction, id: newId, userId: user.uid });
                }
            }

            await batch.commit();
            setTransactionToEdit(null);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar transação no banco de dados.");
        }
    };
    
    const handleGenerateRecurring = async (year: number, month: number) => {
        if (!user) return;
        const batch = writeBatch(db);
        let count = 0;

        const existingSignatures = new Set(
            transactions
                .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date).getMonth() === month - 1)
                .map(t => `${new Date(t.date).getDate()}-${t.accountNumber}-${t.amount}-${t.description}`)
        );

        recurringTransactions.forEach(rt => {
            const transactionDate = new Date(year, month - 1, rt.dayOfMonth);
            if (transactionDate.getMonth() === month - 1) {
                 const signature = `${rt.dayOfMonth}-${rt.accountNumber}-${rt.amount}-${rt.description}`;
                 if (!existingSignatures.has(signature)) {
                    const newId = generateId();
                    const newTrans = {
                        id: newId,
                        date: transactionDate.toISOString().split('T')[0],
                        type: rt.type,
                        accountNumber: rt.accountNumber,
                        accountName: rt.accountName,
                        description: rt.description,
                        amount: rt.amount,
                        payee: rt.payee,
                        paymentMethod: rt.paymentMethod,
                        userId: user.uid
                    };
                    batch.set(doc(db, 'transactions', newId), newTrans);
                    count++;
                 }
            }
        });

        if (count > 0) {
            await batch.commit();
            alert(`${count} lançamento(s) recorrente(s) gerado(s) com sucesso!`);
        } else {
            alert('Nenhum novo lançamento recorrente para gerar neste mês.');
        }
    };


    const handleAIParsedTransaction = async (parsedData: Partial<Transaction>) => {
        if (!user) return;
        const newId = generateId();
        const fullTransaction: Transaction = {
            id: newId,
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
            userId: user.uid
        } as Transaction; // Casting to include userId
        
        try {
            await setDoc(doc(db, 'transactions', newId), { ...fullTransaction, userId: user.uid });
        } catch (e) {
            console.error("Erro AI:", e);
            alert("Erro ao salvar transação da IA.");
        }
    };
    
    // Recurring Transactions Logic (Sync with Firestore)
    const handleSaveRecurring = async (transaction: RecurringTransaction) => {
        if (!user) return;
        try {
            const id = transaction.id || generateId();
            await setDoc(doc(db, 'recurring_transactions', id), { ...transaction, id, userId: user.uid });
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteRecurring = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'recurring_transactions', id));
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

    const ListView = () => (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Conta</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Histórico</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Valor</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{t.accountNumber} - {t.accountName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{t.description}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === TransactionType.ENTRADA ? 'text-green-500' : 'text-red-500'}`}>
                                    {t.type === TransactionType.SAIDA && '- '}{formatCurrency(t.amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                    <button onClick={() => handleEditTransaction(t)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDeleteTransaction(t.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {sortedTransactions.length === 0 && <p className="text-center py-10 text-gray-500 dark:text-gray-400">Nenhum lançamento encontrado para os filtros selecionados.</p>}
        </div>
    );

    if (authLoading) return <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">Carregando...</div>;
    if (!user) return <Login />;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <header className="bg-white dark:bg-gray-800 shadow-md">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Livro Caixa Inteligente</h1>
                    <div className="flex items-center space-x-2">
                        <button onClick={handleSignOut} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 mr-4">
                            Sair
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
                            className="hidden sm:flex items-center bg-gray-600 text-white px-4 py-2 rounded-md shadow hover:bg-gray-700"
                        >
                            <CalendarIcon className="w-5 h-5 mr-2"/>
                            Contas Fixas
                        </button>
                        <button 
                            onClick={handleAddTransaction} 
                            className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700"
                        >
                            <PlusIcon className="w-5 h-5 mr-2"/>
                            Adicionar
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                 <TransactionFilter filters={filters} onFilterChange={setFilters} accounts={accounts} />
                {activeView === 'dashboard' ? <DashboardView /> : <ListView />}
            </main>
            <TransactionForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveTransaction}
                transactionToEdit={transactionToEdit}
                accounts={accounts}
                transactions={transactions}
            />
            <ModifiedRecurringModalWrapper 
                isOpen={isRecurringModalOpen}
                onClose={() => setIsRecurringModalOpen(false)}
                accounts={accounts}
                recurringTransactions={recurringTransactions}
                onSave={handleSaveRecurring}
                onDelete={handleDeleteRecurring}
                onGenerate={handleGenerateRecurring}
            />

            <ExportModal 
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                transactions={filteredTransactions}
            />
            <AiAssistant onTransactionParsed={handleAIParsedTransaction} accounts={accounts} />
        </div>
    );
};

// Helper component to bridge the old Modal interface with new DB handlers
const ModifiedRecurringModalWrapper: React.FC<any> = ({ isOpen, onClose, accounts, recurringTransactions, onSave, onDelete, onGenerate }) => {
    return (
        <RecurringTransactionsModal 
            isOpen={isOpen}
            onClose={onClose}
            accounts={accounts}
            recurringTransactions={recurringTransactions}
            setRecurringTransactions={() => {}} 
            onGenerate={onGenerate}
            // @ts-ignore 
            onSaveItem={onSave}
            onDeleteItem={onDelete}
        />
    )
}

export default App;
