// cacheService.ts - OTIMIZADO
// Implementação com menos iterações e melhor performance

import { Transaction, Account, RecurringTransaction } from './types';

type CacheCollection = 'transactions' | 'accounts' | 'recurring_transactions';

interface SyncMetadata {
  lastSync: number;
  lastWrite?: number;
  hash?: string;
}

// Cache em memória para evitar leituras repetidas do localStorage
const memoryCache = new Map<string, any>();

class CacheService {
  private hasStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private keyFor(userId: string, base: string): string {
    return `${base}_${userId}`;
  }

  private syncKey(userId: string, collection: CacheCollection): string {
    return `sync_meta_${userId}_${collection}`;
  }

  // OTIMIZADO: Leitura com cache em memória
  private readJSON<T>(key: string, fallback: T): T {
    // Verificar cache em memória primeiro
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }

    if (!this.hasStorage()) return fallback;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as T;
      // Armazenar no cache em memória
      memoryCache.set(key, parsed);
      return parsed;
    } catch (err) {
      console.error('Erro ao ler do localStorage:', err);
      return fallback;
    }
  }

  // OTIMIZADO: Escrita com atualização do cache em memória
  private writeJSON(key: string, value: any): void {
    // Atualizar cache em memória
    memoryCache.set(key, value);

    if (!this.hasStorage()) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Erro ao gravar no localStorage:', err);
    }
  }

  private removeKey(key: string): void {
    memoryCache.delete(key);
    
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

  // OTIMIZADO: Aceita userId para evitar varredura de todas as chaves
  async deleteTransaction(id: string, userId?: string): Promise<void> {
    if (userId) {
      // Caminho otimizado quando userId é fornecido
      const key = this.keyFor(userId, 'transactions');
      const list = this.readJSON<Transaction[]>(key, []);
      const filtered = list.filter((t) => t.id !== id);
      this.writeJSON(key, filtered);
      return;
    }

    // Fallback: busca em todas as chaves (evitar se possível)
    if (!this.hasStorage()) return;

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('transactions_')) {
          const list = this.readJSON<Transaction[]>(key, []);
          const filtered = list.filter((t) => t.id !== id);
          if (filtered.length !== list.length) {
            this.writeJSON(key, filtered);
            break; // Encontrou e deletou, pode parar
          }
        }
      }
    } catch (err) {
      console.error('Erro ao excluir transação do cache:', err);
    }
  }

  // OTIMIZADO: Deletar múltiplas transações de uma vez
  async deleteTransactions(ids: string[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    const current = this.readJSON<Transaction[]>(key, []);
    const idSet = new Set(ids);
    const filtered = current.filter((t) => !idSet.has(t.id));
    this.writeJSON(key, filtered);
  }

  async clearTransactions(userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    this.writeJSON(key, []);
  }

  // --- CONTAS ---

  async getAccounts(userId: string): Promise<Account[]> {
    const key = this.keyFor(userId, 'accounts');
    const accounts = this.readJSON<Account[]>(key, []);
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

  // OTIMIZADO: Aceita userId
  async deleteRecurringTransaction(id: string, userId?: string): Promise<void> {
    if (userId) {
      const key = this.keyFor(userId, 'recurring_transactions');
      const list = this.readJSON<RecurringTransaction[]>(key, []);
      const filtered = list.filter((t) => t.id !== id);
      this.writeJSON(key, filtered);
      return;
    }

    // Fallback
    if (!this.hasStorage()) return;

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('recurring_transactions_')) {
          const list = this.readJSON<RecurringTransaction[]>(key, []);
          const filtered = list.filter((t) => t.id !== id);
          if (filtered.length !== list.length) {
            this.writeJSON(key, filtered);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao excluir transação recorrente do cache:', err);
    }
  }

  async clearRecurringTransactions(userId: string): Promise<void> {
    const key = this.keyFor(userId, 'recurring_transactions');
    this.writeJSON(key, []);
  }

  // --- METADADOS DE SINCRONIZAÇÃO ---

  async setSyncMetadata(
    userId: string,
    collection: CacheCollection,
    options?: { preserveLastWrite?: boolean; hash?: string | null }
  ): Promise<void> {
    const key = this.syncKey(userId, collection);
    const existing = (await this.getSyncMetadata(userId, collection)) || {
      lastSync: 0,
    };

    const meta: SyncMetadata = {
      lastSync: Date.now(),
      hash: options?.hash ?? existing.hash,
      lastWrite: options?.preserveLastWrite ? existing.lastWrite : undefined,
    };

    this.writeJSON(key, meta);
  }

  async getSyncMetadata(
    userId: string,
    collection: CacheCollection
  ): Promise<SyncMetadata | null> {
    const key = this.syncKey(userId, collection);
    return this.readJSON<SyncMetadata | null>(key, null);
  }

  async needsSync(
    userId: string,
    collection: CacheCollection,
    maxAgeMinutes: number
  ): Promise<boolean> {
    const meta = await this.getSyncMetadata(userId, collection);
    if (!meta) return true;

    const now = Date.now();
    const ageMinutes = (now - meta.lastSync) / 60000;

    const baseWindow = maxAgeMinutes;
    const writeAwareWindow = meta.lastWrite ? Math.min(baseWindow, 60) : baseWindow;
    const offlinePenalty =
      typeof navigator !== 'undefined' && navigator.onLine === false && !meta.lastWrite
        ? writeAwareWindow * 1.5
        : writeAwareWindow;

    return ageMinutes >= offlinePenalty;
  }

  async markLocalWrite(userId: string, collection: CacheCollection): Promise<void> {
    const key = this.syncKey(userId, collection);
    const meta = (await this.getSyncMetadata(userId, collection)) || {
      lastSync: 0,
    };

    const updated: SyncMetadata = {
      ...meta,
      lastWrite: Date.now(),
    };

    this.writeJSON(key, updated);
  }

  // --- LIMPEZA ---

  async clearAllUserData(userId: string): Promise<void> {
    await this.clearTransactions(userId);
    await this.clearAccounts(userId);
    await this.clearRecurringTransactions(userId);

    const collections: CacheCollection[] = [
      'transactions',
      'accounts',
      'recurring_transactions',
    ];

    collections.forEach((collection) => {
      const key = this.syncKey(userId, collection);
      this.removeKey(key);
    });
  }

  // Limpar cache em memória (útil ao fazer logout ou forçar sync)
  clearMemoryCache(): void {
    memoryCache.clear();
  }

  // Pré-carregar dados no cache em memória
  async preloadCache(userId: string): Promise<void> {
    await Promise.all([
      this.getTransactions(userId),
      this.getAccounts(userId),
      this.getRecurringTransactions(userId),
    ]);
  }
}

export const cacheService = new CacheService();
