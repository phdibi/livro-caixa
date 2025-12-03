// syncService.ts - Serviço de Sincronização Otimizada com Firebase
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, Account, RecurringTransaction } from './types';
import { cacheService } from './cacheService';

// Contas padrão para novos usuários
const initialAccounts: Omit<Account, 'id'>[] = [
  // Despesas
  { number: 101, name: 'Sede', type: 'Despesa' },
  { number: 102, name: 'Administrativas', type: 'Despesa' },
  { number: 103, name: 'Pró-labore', type: 'Despesa' },
  { number: 104, name: 'Assessoria', type: 'Despesa' },
  { number: 105, name: 'Impostos', type: 'Despesa' },
  { number: 106, name: 'Taxas', type: 'Despesa' },
  { number: 107, name: 'Juros', type: 'Despesa' },
  { number: 108, name: 'Folha de pagamento', type: 'Despesa' },
  { number: 109, name: 'Encargos sociais', type: 'Despesa' },
  { number: 110, name: 'Defensivos agricolas', type: 'Despesa' },
  { number: 111, name: 'Serviços terceirizados', type: 'Despesa' },
  { number: 112, name: 'Manutenções de maquinário', type: 'Despesa' },
  { number: 113, name: 'Manutenções de instalações', type: 'Despesa' },
  { number: 114, name: 'Combustíveis', type: 'Despesa' },
  { number: 115, name: 'Arrendamentos', type: 'Despesa' },
  { number: 116, name: 'Fretes', type: 'Despesa' },
  { number: 117, name: 'Comissões', type: 'Despesa' },
  { number: 118, name: 'Sanidade', type: 'Despesa' },
  { number: 119, name: 'Reprodução', type: 'Despesa' },
  { number: 120, name: 'Pastagens', type: 'Despesa' },
  { number: 121, name: 'Suplementação', type: 'Despesa' },
  { number: 122, name: 'Despesa Soja', type: 'Despesa' },
  { number: 123, name: 'Mercado', type: 'Despesa' },
  { number: 124, name: 'Outras despesas', type: 'Despesa' },
  { number: 125, name: 'Cavalos', type: 'Despesa' },
  { number: 126, name: 'Cães', type: 'Despesa' },
  { number: 127, name: 'Suínos e Aves', type: 'Despesa' },
  { number: 128, name: 'Veiculos Pessoais', type: 'Despesa' },
  { number: 129, name: 'Exposições e eventos', type: 'Despesa' },
  { number: 130, name: 'Ferragem', type: 'Despesa' },
  // Investimentos
  { number: 201, name: 'Touros reprodutores', type: 'Despesa' },
  { number: 202, name: 'Novilhos recria', type: 'Despesa' },
  { number: 203, name: 'Novilhas recria', type: 'Despesa' },
  { number: 204, name: 'Novilhas prenhes', type: 'Despesa' },
  { number: 205, name: 'Vacas de invernar', type: 'Despesa' },
  { number: 206, name: 'Vacas prenhes', type: 'Despesa' },
  { number: 207, name: 'Vacas reprodutoras', type: 'Despesa' },
  { number: 208, name: 'Aquisição de Infra estrutura', type: 'Despesa' },
  { number: 209, name: 'Aquisição de maquinários', type: 'Despesa' },
  { number: 210, name: 'Aquisicao animal cavalar', type: 'Despesa' },
  // Receitas
  { number: 301, name: 'Terneiros', type: 'Receita' },
  { number: 302, name: 'Terneiras', type: 'Receita' },
  { number: 303, name: 'Novilhos gordos', type: 'Receita' },
  { number: 304, name: 'Novilhos recria', type: 'Receita' },
  { number: 305, name: 'Novilhas gordas', type: 'Receita' },
  { number: 306, name: 'Novilhas recria', type: 'Receita' },
  { number: 307, name: 'Novilhas prenhes', type: 'Receita' },
  { number: 308, name: 'Vacas de invernar', type: 'Receita' },
  { number: 309, name: 'Vacas gordas', type: 'Receita' },
  { number: 310, name: 'Vacas prenhes', type: 'Receita' },
  { number: 311, name: 'Touros reprodução', type: 'Receita' },
  { number: 312, name: 'Touros descarte', type: 'Receita' },
  { number: 313, name: 'Arrendamentos', type: 'Receita' },
  { number: 314, name: 'Soja', type: 'Receita' },
  { number: 315, name: 'Arroz', type: 'Receita' },
  { number: 316, name: 'Outras culturas', type: 'Receita' },
  { number: 317, name: 'Outros produtos', type: 'Receita' },
  { number: 318, name: 'Receita Financeira', type: 'Receita' },
  { number: 319, name: 'Embrioes', type: 'Receita' },
];

// Helper para gerar UUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

class SyncService {
  private changeListenerUnsubscribe: Unsubscribe | null = null;
  private currentUserId: string | null = null;
  private onDataChange: (() => void) | null = null;
  private enableRealtime = false;
  private transactionSyncOptions: { limit: number; daysWindow: number } = {
    limit: 150,
    daysWindow: 90,
  };

  // ============ INICIALIZAÇÃO ============

  async initialize(
    userId: string,
    onDataChange: () => void,
    options?: { enableRealtimeListener?: boolean; transactionLimit?: number; daysWindow?: number }
  ): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }> {
    this.currentUserId = userId;
    this.onDataChange = onDataChange;
    this.enableRealtime = options?.enableRealtimeListener ?? false;
    this.transactionSyncOptions = {
      limit: options?.transactionLimit ?? this.transactionSyncOptions.limit,
      daysWindow: options?.daysWindow ?? this.transactionSyncOptions.daysWindow,
    };

    // 1. Carregar dados do cache primeiro (instantâneo)
    let transactions = await cacheService.getTransactions(userId);
    let accounts = await cacheService.getAccounts(userId);
    let recurringTransactions =
      await cacheService.getRecurringTransactions(userId);

    // 2. Verificar se precisa sincronizar com Firebase
    const needsTransSync = await cacheService.needsSync(
      userId,
      'transactions',
      240
    ); // 4h padrão
    const needsAccSync = await cacheService.needsSync(
      userId,
      'accounts',
      1440
    ); // 24h para accounts
    const needsRecSync = await cacheService.needsSync(
      userId,
      'recurring_transactions',
      1440
    );

    // 3. Se o cache estiver vazio, forçar sync mesmo que o "needsSync" diga que não
    const shouldSyncTrans = needsTransSync || transactions.length === 0;
    const shouldSyncAcc = needsAccSync || accounts.length === 0;
    const shouldSyncRec =
      needsRecSync || recurringTransactions.length === 0;

    if (shouldSyncTrans || shouldSyncAcc || shouldSyncRec) {
      this.syncInBackground(
        userId,
        shouldSyncTrans,
        shouldSyncAcc,
        shouldSyncRec
      );
    }

    // 4. Listener leve de mudanças somente quando habilitado
    if (this.enableRealtime) {
      this.setupChangeListener(userId);
    }

    return { transactions, accounts, recurringTransactions };
  }

  private async syncInBackground(
    userId: string,
    syncTrans: boolean,
    syncAcc: boolean,
    syncRec: boolean
  ) {
    try {
      if (syncAcc) {
        await this.syncAccounts(userId);
      }
      if (syncTrans) {
        await this.syncTransactions(userId, this.transactionSyncOptions);
      }
      if (syncRec) {
        await this.syncRecurringTransactions(userId);
      }

      if (this.onDataChange) {
        this.onDataChange();
      }
    } catch (error) {
      console.error('Erro na sincronização em background:', error);
    }
  }

  // ============ SYNC ACCOUNTS ============

  private async syncAccounts(userId: string): Promise<Account[]> {
    const q = query(
      collection(db, 'accounts'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Seed accounts para novo usuário
      const accounts = await this.seedAccounts(userId);
      await cacheService.saveAccounts(accounts, userId);
      await cacheService.setSyncMetadata(userId, 'accounts');
      return accounts;
    }

    const accounts = snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Account)
    );

    await cacheService.clearAccounts(userId);
    await cacheService.saveAccounts(accounts, userId);
    await cacheService.setSyncMetadata(userId, 'accounts');

    return accounts;
  }

  private async seedAccounts(userId: string): Promise<Account[]> {
    const batch = writeBatch(db);
    const accounts: Account[] = [];

    initialAccounts.forEach((acc) => {
      const id = generateId();
      const ref = doc(db, 'accounts', id);
      const account = { ...acc, id, userId };
      batch.set(ref, account);
      accounts.push(account as Account);
    });

    await batch.commit();

    await this.updateChangeMarker(userId);

    return accounts;
  }

  // ============ SYNC TRANSACTIONS ============

  private async syncTransactions(
    userId: string,
    options: { limit?: number; startAfterDate?: string; daysWindow?: number } = {}
  ): Promise<Transaction[]> {
    const constraints = [
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
    ];

    if (options.startAfterDate) {
      constraints.push(startAfter(options.startAfterDate));
    }

    const daysWindow = options.daysWindow ?? this.transactionSyncOptions.daysWindow;
    if (daysWindow > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysWindow);
      const iso = fromDate.toISOString().slice(0, 10);
      constraints.push(where('date', '>=', iso));
    }

    const q = query(...constraints, limit(options.limit ?? this.transactionSyncOptions.limit));

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(
      (docSnap) =>
        ({ id: docSnap.id, ...docSnap.data() } as Transaction)
    );

    if (!options.startAfterDate) {
      await cacheService.clearTransactions(userId);
    }

    const currentCache = options.startAfterDate
      ? await cacheService.getTransactions(userId)
      : [];

    await cacheService.saveTransactions(
      options.startAfterDate ? [...currentCache, ...transactions] : transactions,
      userId
    );
    await cacheService.setSyncMetadata(userId, 'transactions');

    return transactions;
  }

  // Carregar transações mais antigas sob demanda (mantido caso queira usar)
  async loadOlderTransactions(
    userId: string,
    beforeDate: string
  ): Promise<Transaction[]> {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      startAfter(beforeDate),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(
      (docSnap) =>
        ({ id: docSnap.id, ...docSnap.data() } as Transaction)
    );

    const existing = await cacheService.getTransactions(userId);
    await cacheService.saveTransactions([...existing, ...transactions], userId);

    return transactions;
  }

  // ============ SYNC RECURRING ============

  private async syncRecurringTransactions(
    userId: string
  ): Promise<RecurringTransaction[]> {
    const q = query(
      collection(db, 'recurring_transactions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    const recurring = snapshot.docs.map(
      (docSnap) =>
        ({ id: docSnap.id, ...docSnap.data() } as RecurringTransaction)
    );

    await cacheService.clearRecurringTransactions(userId);
    await cacheService.saveRecurringTransactions(recurring, userId);
    await cacheService.setSyncMetadata(
      userId,
      'recurring_transactions'
    );

    return recurring;
  }

  // ============ CHANGE LISTENER (OTIMIZADO) ============

  private setupChangeListener(userId: string) {
    if (this.changeListenerUnsubscribe) {
      this.changeListenerUnsubscribe();
      this.changeListenerUnsubscribe = null;
    }

    const controlDocRef = doc(db, 'user_sync', userId);

    this.changeListenerUnsubscribe = onSnapshot(
      controlDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          const lastChange = data?.lastChange?.toMillis?.() || 0;

          cacheService
            .getSyncMetadata(userId, 'transactions')
            .then((meta) => {
              if (meta && lastChange > meta.lastSync) {
                this.syncInBackground(userId, true, false, true);
              }
            })
            .catch((err) =>
              console.error('Erro ao ler metadata de sync:', err)
            );
        }
      },
      (error) => {
        console.error('Erro no listener de mudanças:', error);
      }
    );
  }

  enableRealtimeUpdates() {
    if (!this.currentUserId || this.changeListenerUnsubscribe) return;
    this.enableRealtime = true;
    this.setupChangeListener(this.currentUserId);
  }

  disableRealtimeUpdates() {
    this.enableRealtime = false;
    if (this.changeListenerUnsubscribe) {
      this.changeListenerUnsubscribe();
      this.changeListenerUnsubscribe = null;
    }
  }

  private async updateChangeMarker(userId: string) {
    const controlDocRef = doc(db, 'user_sync', userId);
    await setDoc(
      controlDocRef,
      {
        lastChange: serverTimestamp(),
        userId,
      },
      { merge: true }
    );
  }

  // ============ CRUD OPERATIONS ============

  async saveTransaction(
    transaction: Transaction,
    userId: string
  ): Promise<void> {
    await setDoc(doc(db, 'transactions', transaction.id), {
      ...transaction,
      userId,
    });

    await cacheService.saveTransaction(transaction, userId);
    await cacheService.markLocalWrite(userId, 'transactions');

    await this.updateChangeMarker(userId);
  }

  async saveTransactionsBatch(
    transactions: Transaction[],
    userId: string
  ): Promise<void> {
    const chunks: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += 500) {
      chunks.push(transactions.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((t) => {
        batch.set(doc(db, 'transactions', t.id), { ...t, userId });
      });
      await batch.commit();
    }
    await cacheService.saveTransactions(transactions, userId);
    await cacheService.markLocalWrite(userId, 'transactions');
    await this.updateChangeMarker(userId);
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, 'transactions', id));
    await cacheService.deleteTransaction(id);
    await cacheService.markLocalWrite(userId, 'transactions');
    await this.updateChangeMarker(userId);
  }

  async deleteTransactionsBatch(
    ids: string[],
    userId: string
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      ids.slice(i, i + 500).forEach((id) => {
        batch.delete(doc(db, 'transactions', id));
      });
      await batch.commit();
    }

    // OTIMIZADO: Deletar do cache em paralelo em vez de sequencial
    await Promise.all(ids.map((id) => cacheService.deleteTransaction(id)));

    await cacheService.markLocalWrite(userId, 'transactions');
    await this.updateChangeMarker(userId);
  }

  async saveRecurringTransaction(
    transaction: RecurringTransaction,
    userId: string
  ): Promise<void> {
    await setDoc(
      doc(db, 'recurring_transactions', transaction.id),
      { ...transaction, userId }
    );
    await cacheService.saveRecurringTransaction(transaction, userId);
    await cacheService.markLocalWrite(userId, 'recurring_transactions');
    await this.updateChangeMarker(userId);
  }

  async deleteRecurringTransaction(
    id: string,
    userId: string
  ): Promise<void> {
    await deleteDoc(doc(db, 'recurring_transactions', id));
    await cacheService.deleteRecurringTransaction(id);
    await cacheService.markLocalWrite(userId, 'recurring_transactions');
    await this.updateChangeMarker(userId);
  }

  // ============ FORCE SYNC ============

  async forceFullSync(
    userId: string,
    options?: { transactionLimit?: number; daysWindow?: number }
  ): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }> {
    // Em vez de limpar tudo de uma vez (que pode falhar),
    // usamos os próprios métodos de sync que já limpam o cache de cada tipo.
    const accounts = await this.syncAccounts(userId);
    const transactions = await this.syncTransactions(userId, {
      limit: options?.transactionLimit,
      daysWindow: options?.daysWindow,
    });
    const recurringTransactions =
      await this.syncRecurringTransactions(userId);

    return { transactions, accounts, recurringTransactions };
  }

  // ============ CLEANUP ============

  cleanup() {
    this.disableRealtimeUpdates();
    this.currentUserId = null;
    this.onDataChange = null;
  }

  // ============ GETTERS FROM CACHE ============

  async getCachedTransactions(userId: string): Promise<Transaction[]> {
    return cacheService.getTransactions(userId);
  }

  async getCachedAccounts(userId: string): Promise<Account[]> {
    return cacheService.getAccounts(userId);
  }

  async getCachedRecurringTransactions(
    userId: string
  ): Promise<RecurringTransaction[]> {
    return cacheService.getRecurringTransactions(userId);
  }
}

// Singleton
export const syncService = new SyncService();