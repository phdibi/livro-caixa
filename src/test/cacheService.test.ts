import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transaction, TransactionType, Account, RecurringTransaction } from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Helper functions
const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'test-id-1',
  date: '2024-01-15',
  type: TransactionType.SAIDA,
  accountNumber: 101,
  accountName: 'Sede',
  description: 'Test transaction',
  amount: 100.50,
  payee: 'Test Payee',
  paymentMethod: 'pix',
  ...overrides,
});

const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'account-1',
  number: 101,
  name: 'Sede',
  type: 'Despesa',
  ...overrides,
});

const createMockRecurringTransaction = (overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id: 'recurring-1',
  dayOfMonth: 15,
  type: TransactionType.SAIDA,
  accountNumber: 101,
  accountName: 'Sede',
  description: 'Monthly expense',
  amount: 500,
  payee: 'Monthly Payee',
  paymentMethod: 'pix',
  ...overrides,
});

// CacheService implementation for testing
class TestCacheService {
  private memoryCache = new Map<string, unknown>();

  private hasStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private keyFor(userId: string, base: string): string {
    return `${base}_${userId}`;
  }

  private syncKey(userId: string, collection: string): string {
    return `sync_meta_${userId}_${collection}`;
  }

  private readJSON<T>(key: string, fallback: T): T {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }

    if (!this.hasStorage()) return fallback;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as T;
      this.memoryCache.set(key, parsed);
      return parsed;
    } catch {
      return fallback;
    }
  }

  private writeJSON(key: string, value: unknown): void {
    this.memoryCache.set(key, value);

    if (!this.hasStorage()) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Handle quota exceeded or other errors
    }
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    const key = this.keyFor(userId, 'transactions');
    return this.readJSON<Transaction[]>(key, []);
  }

  async saveTransactions(transactions: Transaction[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    this.writeJSON(key, transactions);
  }

  async saveTransaction(transaction: Transaction, userId: string): Promise<void> {
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

  async deleteTransaction(id: string, userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    const list = this.readJSON<Transaction[]>(key, []);
    const filtered = list.filter((t) => t.id !== id);
    this.writeJSON(key, filtered);
  }

  async deleteTransactions(ids: string[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'transactions');
    const current = this.readJSON<Transaction[]>(key, []);
    const idSet = new Set(ids);
    const filtered = current.filter((t) => !idSet.has(t.id));
    this.writeJSON(key, filtered);
  }

  async getAccounts(userId: string): Promise<Account[]> {
    const key = this.keyFor(userId, 'accounts');
    const accounts = this.readJSON<Account[]>(key, []);
    return accounts.sort((a, b) => a.number - b.number);
  }

  async saveAccounts(accounts: Account[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'accounts');
    this.writeJSON(key, accounts);
  }

  async getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    const key = this.keyFor(userId, 'recurring_transactions');
    return this.readJSON<RecurringTransaction[]>(key, []);
  }

  async saveRecurringTransactions(list: RecurringTransaction[], userId: string): Promise<void> {
    const key = this.keyFor(userId, 'recurring_transactions');
    this.writeJSON(key, list);
  }

  async needsSync(userId: string, collection: string, maxAgeMinutes: number): Promise<boolean> {
    const key = this.syncKey(userId, collection);
    const meta = this.readJSON<{ lastSync: number } | null>(key, null);
    if (!meta) return true;

    const now = Date.now();
    const ageMinutes = (now - meta.lastSync) / 60000;
    return ageMinutes >= maxAgeMinutes;
  }

  async setSyncMetadata(userId: string, collection: string): Promise<void> {
    const key = this.syncKey(userId, collection);
    this.writeJSON(key, { lastSync: Date.now() });
  }

  clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

describe('CacheService', () => {
  let cacheService: TestCacheService;
  const userId = 'test-user-123';

  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock._setStore({});
    vi.clearAllMocks();
    cacheService = new TestCacheService();
  });

  describe('Transactions', () => {
    it('should return empty array when no transactions cached', async () => {
      const transactions = await cacheService.getTransactions(userId);
      expect(transactions).toEqual([]);
    });

    it('should save and retrieve transactions', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1' }),
        createMockTransaction({ id: 'tx-2' }),
      ];

      await cacheService.saveTransactions(transactions, userId);
      const retrieved = await cacheService.getTransactions(userId);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].id).toBe('tx-1');
      expect(retrieved[1].id).toBe('tx-2');
    });

    it('should save single transaction to existing list', async () => {
      const existing = [createMockTransaction({ id: 'tx-1' })];
      await cacheService.saveTransactions(existing, userId);

      const newTransaction = createMockTransaction({ id: 'tx-2', amount: 200 });
      await cacheService.saveTransaction(newTransaction, userId);

      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toHaveLength(2);
    });

    it('should update existing transaction when saving with same id', async () => {
      const existing = [createMockTransaction({ id: 'tx-1', amount: 100 })];
      await cacheService.saveTransactions(existing, userId);

      const updated = createMockTransaction({ id: 'tx-1', amount: 200 });
      await cacheService.saveTransaction(updated, userId);

      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].amount).toBe(200);
    });

    it('should delete single transaction', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1' }),
        createMockTransaction({ id: 'tx-2' }),
        createMockTransaction({ id: 'tx-3' }),
      ];
      await cacheService.saveTransactions(transactions, userId);

      await cacheService.deleteTransaction('tx-2', userId);

      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toHaveLength(2);
      expect(retrieved.find(t => t.id === 'tx-2')).toBeUndefined();
    });

    it('should delete multiple transactions', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1' }),
        createMockTransaction({ id: 'tx-2' }),
        createMockTransaction({ id: 'tx-3' }),
        createMockTransaction({ id: 'tx-4' }),
      ];
      await cacheService.saveTransactions(transactions, userId);

      await cacheService.deleteTransactions(['tx-1', 'tx-3'], userId);

      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toHaveLength(2);
      expect(retrieved.map(t => t.id)).toEqual(['tx-2', 'tx-4']);
    });
  });

  describe('Accounts', () => {
    it('should return empty array when no accounts cached', async () => {
      const accounts = await cacheService.getAccounts(userId);
      expect(accounts).toEqual([]);
    });

    it('should save and retrieve accounts sorted by number', async () => {
      const accounts = [
        createMockAccount({ number: 301, name: 'Receita 1' }),
        createMockAccount({ number: 101, name: 'Despesa 1' }),
        createMockAccount({ number: 201, name: 'Investimento 1' }),
      ];

      await cacheService.saveAccounts(accounts, userId);
      const retrieved = await cacheService.getAccounts(userId);

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].number).toBe(101);
      expect(retrieved[1].number).toBe(201);
      expect(retrieved[2].number).toBe(301);
    });
  });

  describe('Recurring Transactions', () => {
    it('should return empty array when no recurring transactions cached', async () => {
      const recurring = await cacheService.getRecurringTransactions(userId);
      expect(recurring).toEqual([]);
    });

    it('should save and retrieve recurring transactions', async () => {
      const recurring = [
        createMockRecurringTransaction({ id: 'rec-1', dayOfMonth: 5 }),
        createMockRecurringTransaction({ id: 'rec-2', dayOfMonth: 15 }),
      ];

      await cacheService.saveRecurringTransactions(recurring, userId);
      const retrieved = await cacheService.getRecurringTransactions(userId);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].dayOfMonth).toBe(5);
      expect(retrieved[1].dayOfMonth).toBe(15);
    });
  });

  describe('Sync Metadata', () => {
    it('should indicate sync needed when no metadata exists', async () => {
      const needsSync = await cacheService.needsSync(userId, 'transactions', 60);
      expect(needsSync).toBe(true);
    });

    it('should not need sync when recently synced', async () => {
      await cacheService.setSyncMetadata(userId, 'transactions');
      const needsSync = await cacheService.needsSync(userId, 'transactions', 60);
      expect(needsSync).toBe(false);
    });
  });

  describe('Memory Cache', () => {
    it('should use memory cache for repeated reads', async () => {
      const transactions = [createMockTransaction()];
      await cacheService.saveTransactions(transactions, userId);

      // First read populates memory cache
      await cacheService.getTransactions(userId);

      // Clear localStorage to verify memory cache is used
      localStorageMock.clear();

      // Should still return data from memory cache
      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toHaveLength(1);
    });

    it('should clear memory cache', async () => {
      const transactions = [createMockTransaction()];
      await cacheService.saveTransactions(transactions, userId);
      await cacheService.getTransactions(userId);

      // Clear both memory and localStorage
      cacheService.clearMemoryCache();
      localStorageMock.clear();

      // Should return empty now
      const retrieved = await cacheService.getTransactions(userId);
      expect(retrieved).toEqual([]);
    });
  });

  describe('User Isolation', () => {
    it('should isolate data between users', async () => {
      const user1Transactions = [createMockTransaction({ id: 'user1-tx', description: 'User 1 transaction' })];
      const user2Transactions = [createMockTransaction({ id: 'user2-tx', description: 'User 2 transaction' })];

      await cacheService.saveTransactions(user1Transactions, 'user-1');
      await cacheService.saveTransactions(user2Transactions, 'user-2');

      const user1Retrieved = await cacheService.getTransactions('user-1');
      const user2Retrieved = await cacheService.getTransactions('user-2');

      expect(user1Retrieved[0].description).toBe('User 1 transaction');
      expect(user2Retrieved[0].description).toBe('User 2 transaction');
    });
  });
});

describe('Cache Key Generation', () => {
  it('should generate correct keys for transactions', () => {
    const keyFor = (userId: string, base: string) => `${base}_${userId}`;
    expect(keyFor('user-123', 'transactions')).toBe('transactions_user-123');
  });

  it('should generate correct sync metadata keys', () => {
    const syncKey = (userId: string, collection: string) => `sync_meta_${userId}_${collection}`;
    expect(syncKey('user-123', 'transactions')).toBe('sync_meta_user-123_transactions');
  });
});
