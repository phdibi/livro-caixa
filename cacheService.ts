// cacheService.ts
// Implementação simples usando localStorage em vez de IndexedDB
// para evitar erros de versão ("VersionError") e manter o código estável.

import { Transaction, Account, RecurringTransaction } from './types';

type CacheCollection = 'transactions' | 'accounts' | 'recurring_transactions';

interface SyncMetadata {
  lastSync: number; // timestamp em ms
}

class CacheService {
  // --- helpers gerais ---

  private hasStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private keyFor(userId: string, base: string): string {
    return `${base}_${userId}`;
  }

  private syncKey(userId: string, collection: CacheCollection): string {
    return `sync_meta_${userId}_${collection}`;
  }

  private readJSON<T>(key: string, fallback: T): T {
    if (!this.hasStorage()) return fallback;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error('Erro ao ler do localStorage:', err);
      return fallback;
    }
  }

  private writeJSON(key: string, value: any): void {
    if (!this.hasStorage()) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Erro ao gravar no localStorage:', err);
    }
  }

  private removeKey(key: string): void {
    if (!this.hasStorage()) return;

    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.error('Erro ao remover do localStorage:', err);
    }
  }

  // --- TRANSAÇÕES ---

  async getTransactions(userId: string): Promise<Transaction[]> {
    const key = this.keyFor(userId, 'transactions');
    return this.readJSON<Transaction[]>(key, []);
  }

  async saveTransactions(
    transactions: Transaction[],
    userId: string
  ): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    this.writeJSON(key, transactions);
  }

  async saveTransaction(
    transaction: Transaction,
    userId: string
  ): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    const current = this.readJSON<Transaction[]>(key, []);

    const index = current.findIndex((t) => t.id === transaction.id);
    if (index >= 0) {
      current[index] = transaction;
    } else {
      current.push(transaction);
    }

    this.writeJSON(key, current);
  }

  // ATENÇÃO: aqui não temos userId, então procuramos o id em todas
  // as chaves de transações_* existentes. Na prática você só terá 1 usuário.
  async deleteTransaction(id: string): Promise<void> {
    if (!this.hasStorage()) return;

    try {
      const keysToUpdate: string[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('transactions_')) {
          keysToUpdate.push(key);
        }
      }

      keysToUpdate.forEach((key) => {
        const list = this.readJSON<Transaction[]>(key, []);
        const filtered = list.filter((t) => t.id !== id);
        this.writeJSON(key, filtered);
      });
    } catch (err) {
      console.error('Erro ao excluir transação do cache:', err);
    }
  }

  async clearTransactions(userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    this.writeJSON(key, []);
  }

  // --- CONTAS ---

  async getAccounts(userId: string): Promise<Account[]> {
    const key = this.keyFor(userId, 'accounts');
    const accounts = this.readJSON<Account[]>(key, []);
    // Garantir ordenação por número (usado diversas vezes no app)
    return accounts.sort((a, b) => a.number - b.number);
  }

  async saveAccounts(accounts: Account[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'accounts');
    this.writeJSON(key, accounts);
  }

  async clearAccounts(userId: string): Promise<void> {
    const key = this.keyFor(userId, 'accounts');
    this.writeJSON(key, []);
  }

  // --- RECURRING (CONTAS FIXAS) ---

  async getRecurringTransactions(
    userId: string
  ): Promise<RecurringTransaction[]> {
    const key = this.keyFor(userId, 'recurring_transactions');
    return this.readJSON<RecurringTransaction[]>(key, []);
  }

  async saveRecurringTransactions(
    list: RecurringTransaction[],
    userId: string
  ): Promise<void> {
    const key = this.keyFor(userId, 'recurring_transactions');
    this.writeJSON(key, list);
  }

  async saveRecurringTransaction(
    item: RecurringTransaction,
    userId: string
  ): Promise<void> {
    const key = this.keyFor(userId, 'recurring_transactions');
    const current = this.readJSON<RecurringTransaction[]>(key, []);
    const index = current.findIndex((t) => t.id === item.id);
    if (index >= 0) {
      current[index] = item;
    } else {
      current.push(item);
    }
    this.writeJSON(key, current);
  }

  async deleteRecurringTransaction(id: string): Promise<void> {
    if (!this.hasStorage()) return;

    try {
      const keysToUpdate: string[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('recurring_transactions_')) {
          keysToUpdate.push(key);
        }
      }

      keysToUpdate.forEach((key) => {
        const list = this.readJSON<RecurringTransaction[]>(key, []);
        const filtered = list.filter((t) => t.id !== id);
        this.writeJSON(key, filtered);
      });
    } catch (err) {
      console.error(
        'Erro ao excluir transação recorrente do cache:',
        err
      );
    }
  }

  async clearRecurringTransactions(userId: string): Promise<void> {
    const key = this.keyFor(userId, 'recurring_transactions');
    this.writeJSON(key, []);
  }

  // --- METADADOS DE SINCRONIZAÇÃO ---

  async setSyncMetadata(
    userId: string,
    collection: CacheCollection
  ): Promise<void> {
    const key = this.syncKey(userId, collection);
    const meta: SyncMetadata = { lastSync: Date.now() };
    this.writeJSON(key, meta);
  }

  async getSyncMetadata(
    userId: string,
    collection: CacheCollection
  ): Promise<SyncMetadata | null> {
    const key = this.syncKey(userId, collection);
    const meta = this.readJSON<SyncMetadata | null>(key, null as any);
    return meta ?? null;
  }

  async needsSync(
    userId: string,
    collection: CacheCollection,
    maxAgeMinutes: number
  ): Promise<boolean> {
    const meta = await this.getSyncMetadata(userId, collection);
    if (!meta) return true;

    const ageMs = Date.now() - meta.lastSync;
    const ageMinutes = ageMs / 60000;
    return ageMinutes >= maxAgeMinutes;
  }

  // --- LIMPEZA GERAL ---

  async clearAllUserData(userId: string): Promise<void> {
    // limpa dados
    await this.clearTransactions(userId);
    await this.clearAccounts(userId);
    await this.clearRecurringTransactions(userId);

    // limpa metadados
    (['transactions', 'accounts', 'recurring_transactions'] as CacheCollection[]).forEach(
      (collection) => {
        const key = this.syncKey(userId, collection);
        this.removeKey(key);
      }
    );
  }
}

export const cacheService = new CacheService();
