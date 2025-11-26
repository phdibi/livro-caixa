// syncService.ts - Serviço de Sincronização Otimizada com Firebase
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot
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

// Calcular data de 6 meses atrás
const getSixMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split('T')[0];
};

class SyncService {
  private changeListenerUnsubscribe: Unsubscribe | null = null;
  private currentUserId: string | null = null;
  private onDataChange: (() => void) | null = null;

  // ============ INICIALIZAÇÃO ============

  async initialize(userId: string, onDataChange: () => void): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }> {
    this.currentUserId = userId;
    this.onDataChange = onDataChange;

    // 1. Carregar dados do cache primeiro (instantâneo)
    let transactions = await cacheService.getTransactions(userId);
    let accounts = await cacheService.getAccounts(userId);
    let recurringTransactions = await cacheService.getRecurringTransactions(userId);

    // 2. Verificar se precisa sincronizar com Firebase
    const needsTransSync = await cacheService.needsSync(userId, 'transactions', 60); // 60 min
    const needsAccSync = await cacheService.needsSync(userId, 'accounts', 1440); // 24h para accounts
    const needsRecSync = await cacheService.needsSync(userId, 'recurring_transactions', 60);

    // 3. Sincronizar se necessário (em background, sem bloquear UI)
    if (needsTransSync || needsAccSync || needsRecSync || transactions.length === 0) {
      this.syncInBackground(userId, needsTransSync, needsAccSync, needsRecSync);
    }

    // 4. Configurar listener leve para mudanças (apenas 1 documento de controle)
    this.setupChangeListener(userId);

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
        await this.syncTransactions(userId);
      }
      if (syncRec) {
        await this.syncRecurringTransactions(userId);
      }
      
      // Notificar que dados foram atualizados
      if (this.onDataChange) {
        this.onDataChange();
      }
    } catch (error) {
      console.error('Erro na sincronização em background:', error);
    }
  }

  // ============ SYNC ACCOUNTS ============

  private async syncAccounts(userId: string): Promise<Account[]> {
    const q = query(collection(db, 'accounts'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Seed accounts para novo usuário
      const accounts = await this.seedAccounts(userId);
      await cacheService.saveAccounts(accounts, userId);
      await cacheService.setSyncMetadata(userId, 'accounts');
      return accounts;
    }

    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
    await cacheService.clearAccounts(userId);
    await cacheService.saveAccounts(accounts, userId);
    await cacheService.setSyncMetadata(userId, 'accounts');
    
    return accounts;
  }

  private async seedAccounts(userId: string): Promise<Account[]> {
    const batch = writeBatch(db);
    const accounts: Account[] = [];

    initialAccounts.forEach(acc => {
      const id = generateId();
      const ref = doc(db, 'accounts', id);
      const account = { ...acc, id, userId };
      batch.set(ref, account);
      accounts.push(account as Account);
    });

    await batch.commit();
    
    // Atualizar documento de controle
    await this.updateChangeMarker(userId);
    
    return accounts;
  }

  // ============ SYNC TRANSACTIONS ============

  private async syncTransactions(userId: string): Promise<Transaction[]> {
    // Carregar apenas últimos 6 meses por padrão
    const sixMonthsAgo = getSixMonthsAgo();
    
    const q = query(
      collection(db, 'transactions'), 
      where('userId', '==', userId),
      where('date', '>=', sixMonthsAgo)
    );
    
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    
    // Limpar cache antigo e salvar novos dados
    await cacheService.clearTransactions(userId);
    await cacheService.saveTransactions(transactions, userId);
    await cacheService.setSyncMetadata(userId, 'transactions');
    
    return transactions;
  }

  // Carregar transações mais antigas sob demanda
  async loadOlderTransactions(userId: string, beforeDate: string): Promise<Transaction[]> {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('date', '<', beforeDate),
      orderBy('date', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    
    // Adicionar ao cache existente
    await cacheService.saveTransactions(transactions, userId);
    
    return transactions;
  }

  // ============ SYNC RECURRING ============

  private async syncRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    const q = query(collection(db, 'recurring_transactions'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const recurring = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTransaction));
    
    await cacheService.clearRecurringTransactions(userId);
    await cacheService.saveRecurringTransactions(recurring, userId);
    await cacheService.setSyncMetadata(userId, 'recurring_transactions');
    
    return recurring;
  }

  // ============ CHANGE LISTENER (OTIMIZADO) ============

  private setupChangeListener(userId: string) {
    // Limpar listener anterior
    if (this.changeListenerUnsubscribe) {
      this.changeListenerUnsubscribe();
    }

    // Listener em apenas UM documento de controle, não em toda a coleção
    const controlDocRef = doc(db, 'user_sync', userId);
    
    this.changeListenerUnsubscribe = onSnapshot(controlDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const lastChange = data?.lastChange?.toMillis?.() || 0;
        
        // Verificar se a mudança é mais recente que nosso último sync
        cacheService.getSyncMetadata(userId, 'transactions').then(meta => {
          if (meta && lastChange > meta.lastSync) {
            // Há mudanças! Sincronizar em background
            this.syncInBackground(userId, true, false, true);
          }
        });
      }
    }, (error) => {
      console.error('Erro no listener de mudanças:', error);
    });
  }

  private async updateChangeMarker(userId: string) {
    const controlDocRef = doc(db, 'user_sync', userId);
    await setDoc(controlDocRef, {
      lastChange: serverTimestamp(),
      userId
    }, { merge: true });
  }

  // ============ CRUD OPERATIONS ============

  async saveTransaction(transaction: Transaction, userId: string): Promise<void> {
    // 1. Salvar no Firebase
    await setDoc(doc(db, 'transactions', transaction.id), { ...transaction, userId });
    
    // 2. Salvar no cache local
    await cacheService.saveTransaction(transaction, userId);
    
    // 3. Atualizar marcador de mudança
    await this.updateChangeMarker(userId);
  }

  async saveTransactionsBatch(transactions: Transaction[], userId: string): Promise<void> {
    const batch = writeBatch(db);
    
    transactions.forEach(t => {
      batch.set(doc(db, 'transactions', t.id), { ...t, userId });
    });
    
    await batch.commit();
    await cacheService.saveTransactions(transactions, userId);
    await this.updateChangeMarker(userId);
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, 'transactions', id));
    await cacheService.deleteTransaction(id);
    await this.updateChangeMarker(userId);
  }

  async deleteTransactionsBatch(ids: string[], userId: string): Promise<void> {
    const batch = writeBatch(db);
    
    ids.forEach(id => {
      batch.delete(doc(db, 'transactions', id));
    });
    
    await batch.commit();
    
    for (const id of ids) {
      await cacheService.deleteTransaction(id);
    }
    
    await this.updateChangeMarker(userId);
  }

  async saveRecurringTransaction(transaction: RecurringTransaction, userId: string): Promise<void> {
    await setDoc(doc(db, 'recurring_transactions', transaction.id), { ...transaction, userId });
    await cacheService.saveRecurringTransaction(transaction, userId);
    await this.updateChangeMarker(userId);
  }

  async deleteRecurringTransaction(id: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, 'recurring_transactions', id));
    await cacheService.deleteRecurringTransaction(id);
    await this.updateChangeMarker(userId);
  }

  // ============ FORCE SYNC ============

  async forceFullSync(userId: string): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }> {
    // Limpar cache e recarregar tudo
    await cacheService.clearAllUserData(userId);
    
    const accounts = await this.syncAccounts(userId);
    const transactions = await this.syncTransactions(userId);
    const recurringTransactions = await this.syncRecurringTransactions(userId);
    
    return { transactions, accounts, recurringTransactions };
  }

  // ============ CLEANUP ============

  cleanup() {
    if (this.changeListenerUnsubscribe) {
      this.changeListenerUnsubscribe();
      this.changeListenerUnsubscribe = null;
    }
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

  async getCachedRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    return cacheService.getRecurringTransactions(userId);
  }
}

// Singleton
export const syncService = new SyncService();
