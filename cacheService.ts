// cacheService.ts - Serviço de Cache com IndexedDB
import { Transaction, Account, RecurringTransaction } from './types';

const DB_NAME = 'LivroCaixaDB';
const DB_VERSION = 1;

interface SyncMetadata {
  id: string;
  collection: string;
  lastSync: number;
  userId: string;
}

class CacheService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para transações
        if (!db.objectStoreNames.contains('transactions')) {
          const transStore = db.createObjectStore('transactions', { keyPath: 'id' });
          transStore.createIndex('userId', 'userId', { unique: false });
          transStore.createIndex('date', 'date', { unique: false });
          transStore.createIndex('userDate', ['userId', 'date'], { unique: false });
        }

        // Store para contas
        if (!db.objectStoreNames.contains('accounts')) {
          const accStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accStore.createIndex('userId', 'userId', { unique: false });
        }

        // Store para transações recorrentes
        if (!db.objectStoreNames.contains('recurring_transactions')) {
          const recStore = db.createObjectStore('recurring_transactions', { keyPath: 'id' });
          recStore.createIndex('userId', 'userId', { unique: false });
        }

        // Store para metadados de sincronização
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'id' });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.dbReady;
  }

  // ============ TRANSACTIONS ============

  async getTransactions(userId: string, startDate?: string, endDate?: string): Promise<Transaction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readonly');
      const store = transaction.objectStore('transactions');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        let results = request.result as Transaction[];
        
        // Filtrar por data se especificado
        if (startDate || endDate) {
          results = results.filter(t => {
            if (startDate && t.date < startDate) return false;
            if (endDate && t.date > endDate) return false;
            return true;
          });
        }
        
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveTransactions(transactions: Transaction[], userId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readwrite');
      const store = transaction.objectStore('transactions');

      transactions.forEach(t => {
        store.put({ ...t, userId });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveTransaction(trans: Transaction, userId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readwrite');
      const store = transaction.objectStore('transactions');
      store.put({ ...trans, userId });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readwrite');
      const store = transaction.objectStore('transactions');
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearTransactions(userId: string): Promise<void> {
    const transactions = await this.getTransactions(userId);
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readwrite');
      const store = transaction.objectStore('transactions');
      
      transactions.forEach(t => store.delete(t.id));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============ ACCOUNTS ============

  async getAccounts(userId: string): Promise<Account[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('accounts', 'readonly');
      const store = transaction.objectStore('accounts');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result as Account[]);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAccounts(accounts: Account[], userId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('accounts', 'readwrite');
      const store = transaction.objectStore('accounts');

      accounts.forEach(a => {
        store.put({ ...a, userId });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAccounts(userId: string): Promise<void> {
    const accounts = await this.getAccounts(userId);
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('accounts', 'readwrite');
      const store = transaction.objectStore('accounts');
      
      accounts.forEach(a => store.delete(a.id));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============ RECURRING TRANSACTIONS ============

  async getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recurring_transactions', 'readonly');
      const store = transaction.objectStore('recurring_transactions');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result as RecurringTransaction[]);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRecurringTransactions(transactions: RecurringTransaction[], userId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recurring_transactions', 'readwrite');
      const store = transaction.objectStore('recurring_transactions');

      transactions.forEach(t => {
        store.put({ ...t, userId });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveRecurringTransaction(trans: RecurringTransaction, userId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recurring_transactions', 'readwrite');
      const store = transaction.objectStore('recurring_transactions');
      store.put({ ...trans, userId });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteRecurringTransaction(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recurring_transactions', 'readwrite');
      const store = transaction.objectStore('recurring_transactions');
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearRecurringTransactions(userId: string): Promise<void> {
    const recurring = await this.getRecurringTransactions(userId);
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recurring_transactions', 'readwrite');
      const store = transaction.objectStore('recurring_transactions');
      
      recurring.forEach(r => store.delete(r.id));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============ SYNC METADATA ============

  async getSyncMetadata(userId: string, collection: string): Promise<SyncMetadata | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sync_metadata', 'readonly');
      const store = transaction.objectStore('sync_metadata');
      const request = store.get(`${userId}_${collection}`);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async setSyncMetadata(userId: string, collection: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sync_metadata', 'readwrite');
      const store = transaction.objectStore('sync_metadata');
      
      store.put({
        id: `${userId}_${collection}`,
        collection,
        lastSync: Date.now(),
        userId
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAllSyncMetadata(userId: string): Promise<void> {
    const db = await this.getDB();
    const collections = ['transactions', 'accounts', 'recurring_transactions'];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sync_metadata', 'readwrite');
      const store = transaction.objectStore('sync_metadata');
      
      collections.forEach(c => store.delete(`${userId}_${c}`));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============ UTILITY ============

  async clearAllUserData(userId: string): Promise<void> {
    await this.clearTransactions(userId);
    await this.clearAccounts(userId);
    await this.clearRecurringTransactions(userId);
    await this.clearAllSyncMetadata(userId);
  }

  async needsSync(userId: string, collection: string, maxAgeMinutes: number = 30): Promise<boolean> {
    const metadata = await this.getSyncMetadata(userId, collection);
    if (!metadata) return true;
    
    const age = Date.now() - metadata.lastSync;
    return age > maxAgeMinutes * 60 * 1000;
  }
}

// Singleton instance
export const cacheService = new CacheService();
