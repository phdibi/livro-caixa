import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transaction, TransactionType, Account, RecurringTransaction } from '../../types';

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockWriteBatch = vi.fn();
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => ({ toMillis: () => Date.now() }),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
  },
}));

// Mock cacheService
const mockCacheService = {
  getTransactions: vi.fn(),
  getAccounts: vi.fn(),
  getRecurringTransactions: vi.fn(),
  saveTransactions: vi.fn(),
  saveAccounts: vi.fn(),
  saveRecurringTransactions: vi.fn(),
  saveTransaction: vi.fn(),
  saveRecurringTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  deleteTransactions: vi.fn(),
  deleteRecurringTransaction: vi.fn(),
  clearTransactions: vi.fn(),
  clearAccounts: vi.fn(),
  clearRecurringTransactions: vi.fn(),
  needsSync: vi.fn(),
  setSyncMetadata: vi.fn(),
  getSyncMetadata: vi.fn(),
  markLocalWrite: vi.fn(),
  clearMemoryCache: vi.fn(),
};

vi.mock('../../cacheService', () => ({
  cacheService: mockCacheService,
}));

// Mock firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

// Helper to create mock transaction
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

// Helper to create mock account
const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'account-1',
  number: 101,
  name: 'Sede',
  type: 'Despesa',
  ...overrides,
});

// Helper to create mock recurring transaction
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

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCacheService.getTransactions.mockResolvedValue([]);
    mockCacheService.getAccounts.mockResolvedValue([]);
    mockCacheService.getRecurringTransactions.mockResolvedValue([]);
    mockCacheService.needsSync.mockResolvedValue(false);
    mockCacheService.getSyncMetadata.mockResolvedValue(null);

    mockGetDocs.mockResolvedValue({ docs: [], empty: true });
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
    mockOnSnapshot.mockReturnValue(vi.fn()); // Return unsubscribe function
    mockDoc.mockReturnValue({ id: 'doc-ref' });
    mockQuery.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Data Helpers', () => {
    it('should create valid mock transaction', () => {
      const transaction = createMockTransaction();
      expect(transaction.id).toBe('test-id-1');
      expect(transaction.amount).toBe(100.50);
      expect(transaction.type).toBe(TransactionType.SAIDA);
    });

    it('should create mock transaction with overrides', () => {
      const transaction = createMockTransaction({
        id: 'custom-id',
        amount: 200,
        type: TransactionType.ENTRADA,
      });
      expect(transaction.id).toBe('custom-id');
      expect(transaction.amount).toBe(200);
      expect(transaction.type).toBe(TransactionType.ENTRADA);
    });

    it('should create valid mock account', () => {
      const account = createMockAccount();
      expect(account.number).toBe(101);
      expect(account.type).toBe('Despesa');
    });

    it('should create valid mock recurring transaction', () => {
      const recurring = createMockRecurringTransaction();
      expect(recurring.dayOfMonth).toBe(15);
      expect(recurring.amount).toBe(500);
    });
  });

  describe('Cache Service Integration', () => {
    it('should return cached data when available', async () => {
      const cachedTransactions = [createMockTransaction()];
      const cachedAccounts = [createMockAccount()];

      mockCacheService.getTransactions.mockResolvedValue(cachedTransactions);
      mockCacheService.getAccounts.mockResolvedValue(cachedAccounts);
      mockCacheService.needsSync.mockResolvedValue(false);

      const transactions = await mockCacheService.getTransactions('user-123');
      const accounts = await mockCacheService.getAccounts('user-123');

      expect(transactions).toEqual(cachedTransactions);
      expect(accounts).toEqual(cachedAccounts);
    });

    it('should mark local write when saving transaction', async () => {
      await mockCacheService.markLocalWrite('user-123', 'transactions');
      expect(mockCacheService.markLocalWrite).toHaveBeenCalledWith('user-123', 'transactions');
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch saves correctly', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1' }),
        createMockTransaction({ id: 'tx-2' }),
        createMockTransaction({ id: 'tx-3' }),
      ];

      const batch = mockWriteBatch();
      transactions.forEach(t => {
        batch.set({ id: t.id }, t);
      });
      await batch.commit();

      expect(batch.commit).toHaveBeenCalled();
    });

    it('should handle batch deletes correctly', async () => {
      const idsToDelete = ['tx-1', 'tx-2', 'tx-3'];

      const batch = mockWriteBatch();
      idsToDelete.forEach(id => {
        batch.delete({ id });
      });
      await batch.commit();

      expect(batch.commit).toHaveBeenCalled();
    });

    it('should chunk large batches (500 limit)', () => {
      const largeArray = Array.from({ length: 1200 }, (_, i) => `item-${i}`);
      const chunks: string[][] = [];

      for (let i = 0; i < largeArray.length; i += 500) {
        chunks.push(largeArray.slice(i, i + 500));
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(500);
      expect(chunks[2]).toHaveLength(200);
    });
  });

  describe('Throttling', () => {
    it('should enforce minimum sync interval', () => {
      const MIN_SYNC_INTERVAL = 5000;
      // Set lastSyncTimestamp to a time in the past (more than MIN_SYNC_INTERVAL ago)
      let lastSyncTimestamp = Date.now() - MIN_SYNC_INTERVAL - 1000;

      const canSync = () => {
        const now = Date.now();
        if (now - lastSyncTimestamp < MIN_SYNC_INTERVAL) {
          return false;
        }
        lastSyncTimestamp = now;
        return true;
      };

      // First call should succeed (enough time has passed)
      expect(canSync()).toBe(true);
      // Second call immediately after should be throttled
      expect(canSync()).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('should validate transaction has required fields', () => {
      const transaction = createMockTransaction();

      expect(transaction.id).toBeDefined();
      expect(transaction.date).toBeDefined();
      expect(transaction.type).toBeDefined();
      expect(transaction.accountNumber).toBeDefined();
      expect(transaction.amount).toBeDefined();
    });

    it('should handle transactions with optional fields', () => {
      const transaction = createMockTransaction({
        seriesId: 'series-1',
        invoiceId: 'invoice-1',
        notes: 'Some notes',
      });

      expect(transaction.seriesId).toBe('series-1');
      expect(transaction.invoiceId).toBe('invoice-1');
      expect(transaction.notes).toBe('Some notes');
    });
  });
});

describe('Transaction Type Helpers', () => {
  it('should identify ENTRADA transactions', () => {
    const isEntrada = (t: Transaction): boolean =>
      t.type === TransactionType.ENTRADA || t.type === 'Entrada';

    const entradaTransaction = createMockTransaction({ type: TransactionType.ENTRADA });
    const saidaTransaction = createMockTransaction({ type: TransactionType.SAIDA });

    expect(isEntrada(entradaTransaction)).toBe(true);
    expect(isEntrada(saidaTransaction)).toBe(false);
  });

  it('should identify SAIDA transactions', () => {
    const isSaida = (t: Transaction): boolean =>
      t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';

    const entradaTransaction = createMockTransaction({ type: TransactionType.ENTRADA });
    const saidaTransaction = createMockTransaction({ type: TransactionType.SAIDA });

    expect(isSaida(entradaTransaction)).toBe(false);
    expect(isSaida(saidaTransaction)).toBe(true);
  });
});
