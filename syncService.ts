// syncService.ts - Sincronização com suporte OFFLINE REAL
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
} from "firebase/firestore";
import { db } from "./firebase";
import { Transaction, Account, RecurringTransaction } from "./types";
import {
  cacheService,
  PendingOperation,
  PendingCollection,
} from "./cacheService";

// ========== CONTAS PADRÃO ==========
const initialAccounts: Omit<Account, "id">[] = [
  { number: 101, name: "Sede", type: "Despesa" },
  { number: 102, name: "Administrativas", type: "Despesa" },
  { number: 103, name: "Pró-labore", type: "Despesa" },
  { number: 104, name: "Assessoria", type: "Despesa" },
  { number: 105, name: "Impostos", type: "Despesa" },
  { number: 106, name: "Taxas", type: "Despesa" },
  { number: 107, name: "Juros", type: "Despesa" },
  { number: 108, name: "Folha de pagamento", type: "Despesa" },
  { number: 109, name: "Encargos sociais", type: "Despesa" },
  { number: 110, name: "Defensivos agricolas", type: "Despesa" },
  { number: 111, name: "Serviços terceirizados", type: "Despesa" },
  { number: 112, name: "Manutenções de maquinário", type: "Despesa" },
  { number: 113, name: "Manutenções de instalações", type: "Despesa" },
  { number: 114, name: "Combustíveis", type: "Despesa" },
  { number: 115, name: "Arrendamentos", type: "Despesa" },
  { number: 116, name: "Fretes", type: "Despesa" },
  { number: 117, name: "Comissões", type: "Despesa" },
  { number: 118, name: "Sanidade", type: "Despesa" },
  { number: 119, name: "Reprodução", type: "Despesa" },
  { number: 120, name: "Pastagens", type: "Despesa" },
  { number: 121, name: "Suplementação", type: "Despesa" },
  { number: 122, name: "Despesa Soja", type: "Despesa" },
  { number: 123, name: "Mercado", type: "Despesa" },
  { number: 124, name: "Outras despesas", type: "Despesa" },
  { number: 125, name: "Cavalos", type: "Despesa" },
  { number: 126, name: "Cães", type: "Despesa" },
  { number: 127, name: "Suínos e Aves", type: "Despesa" },
  { number: 128, name: "Veiculos Pessoais", type: "Despesa" },
  { number: 129, name: "Exposições e eventos", type: "Despesa" },
  { number: 130, name: "Ferragem", type: "Despesa" },

  { number: 201, name: "Touros reprodutores", type: "Despesa" },
  { number: 202, name: "Novilhos recria", type: "Despesa" },
  { number: 203, name: "Novilhas recria", type: "Despesa" },
  { number: 204, name: "Novilhas prenhes", type: "Despesa" },
  { number: 205, name: "Vacas de invernar", type: "Despesa" },
  { number: 206, name: "Vacas prenhes", type: "Despesa" },
  { number: 207, name: "Vacas reprodutoras", type: "Despesa" },
  { number: 208, name: "Aquisição de Infra estrutura", type: "Despesa" },
  { number: 209, name: "Aquisição de maquinários", type: "Despesa" },
  { number: 210, name: "Aquisicao animal cavalar", type: "Despesa" },

  { number: 301, name: "Terneiros", type: "Receita" },
  { number: 302, name: "Terneiras", type: "Receita" },
  { number: 303, name: "Novilhos gordos", type: "Receita" },
  { number: 304, name: "Novilhos recria", type: "Receita" },
  { number: 305, name: "Novilhas gordas", type: "Receita" },
  { number: 306, name: "Novilhas recria", type: "Receita" },
  { number: 307, name: "Novilhas prenhes", type: "Receita" },
  { number: 308, name: "Vacas de invernar", type: "Receita" },
  { number: 309, name: "Vacas gordas", type: "Receita" },
  { number: 310, name: "Vacas prenhes", type: "Receita" },
  { number: 311, name: "Touros reprodução", type: "Receita" },
  { number: 312, name: "Touros descarte", type: "Receita" },
  { number: 313, name: "Arrendamentos", type: "Receita" },
  { number: 314, name: "Soja", type: "Receita" },
  { number: 315, name: "Arroz", type: "Receita" },
  { number: 316, name: "Outras culturas", type: "Receita" },
  { number: 317, name: "Outros produtos", type: "Receita" },
  { number: 318, name: "Receita Financeira", type: "Receita" },
  { number: 319, name: "Embrioes", type: "Receita" },
];

// ========== HELPERS ==========
const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  );
};

const getSixMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split("T")[0];
};

// ========== SYNC SERVICE ==========
class SyncService {
  private changeListenerUnsubscribe: Unsubscribe | null = null;
  private currentUserId: string | null = null;
  private onDataChange: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;

  private get isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  }

  // ========== INITIALIZE ==========
  async initialize(
    userId: string,
    onDataChange: () => void
  ): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }> {
    this.currentUserId = userId;
    this.onDataChange = onDataChange;

    this.setupOnlineListener();

    const transactions = await cacheService.getTransactions(userId);
    const accounts = await cacheService.getAccounts(userId);
    const recurringTransactions =
      await cacheService.getRecurringTransactions(userId);

    if (this.isOnline) {
      await this.syncPendingOperations(userId);
    }

    const needsTrans = await cacheService.needsSync(userId, "transactions", 60);
    const needsAcc = await cacheService.needsSync(userId, "accounts", 1440);
    const needsRec = await cacheService.needsSync(
      userId,
      "recurring_transactions",
      60
    );

    if (this.isOnline && (needsTrans || needsAcc || needsRec)) {
      this.syncInBackground(userId, needsTrans, needsAcc, needsRec);
    }

    this.setupChangeListener(userId);

    return { transactions, accounts, recurringTransactions };
  }

  private setupOnlineListener() {
    if (typeof window === "undefined") return;
    if (this.onlineListener) return;

    this.onlineListener = () => {
      if (!this.currentUserId) return;

      this.syncPendingOperations(this.currentUserId)
        .then(() =>
          this.syncInBackground(
            this.currentUserId!,
            true,
            true,
            true
          )
        )
        .catch(console.error);
    };

    window.addEventListener("online", this.onlineListener);
  }

  private async syncInBackground(
    userId: string,
    doTrans: boolean,
    doAcc: boolean,
    doRec: boolean
  ) {
    try {
      if (doAcc) await this.syncAccounts(userId);
      if (doTrans) await this.syncTransactions(userId);
      if (doRec) await this.syncRecurringTransactions(userId);

      this.onDataChange && this.onDataChange();
    } catch (err) {
      console.error("Erro background sync:", err);
    }
  }

  // ========== FIRESTORE SYNC ==========
  private async syncAccounts(userId: string): Promise<Account[]> {
    const q = query(collection(db, "accounts"), where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const accounts = await this.seedAccounts(userId);
      await cacheService.saveAccounts(accounts, userId);
      await cacheService.setSyncMetadata(userId, "accounts");
      return accounts;
    }

    const accounts = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Account)
    );

    await cacheService.clearAccounts(userId);
    await cacheService.saveAccounts(accounts, userId);
    await cacheService.setSyncMetadata(userId, "accounts");

    return accounts;
  }

  private async seedAccounts(userId: string): Promise<Account[]> {
    const batch = writeBatch(db);
    const accounts: Account[] = [];

    initialAccounts.forEach((acc) => {
      const id = generateId();
      const ref = doc(db, "accounts", id);
      const account = { ...acc, id, userId };
      batch.set(ref, account);
      accounts.push(account);
    });

    await batch.commit();
    await this.updateChangeMarker(userId);

    return accounts;
  }

  private async syncTransactions(userId: string): Promise<Transaction[]> {
    const sixMonthsAgo = getSixMonthsAgo();

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
      where("date", ">=", sixMonthsAgo)
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Transaction)
    );

    await cacheService.clearTransactions(userId);
    await cacheService.saveTransactions(transactions, userId);
    await cacheService.setSyncMetadata(userId, "transactions");

    return transactions;
  }

  private async syncRecurringTransactions(
    userId: string
  ): Promise<RecurringTransaction[]> {
    const q = query(
      collection(db, "recurring_transactions"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    const recurring = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as RecurringTransaction)
    );

    await cacheService.clearRecurringTransactions(userId);
    await cacheService.saveRecurringTransactions(recurring, userId);
    await cacheService.setSyncMetadata(userId, "recurring_transactions");

    return recurring;
  }

  // ========== CHANGE LISTENER ==========
  private setupChangeListener(userId: string) {
    if (this.changeListenerUnsubscribe)
      this.changeListenerUnsubscribe();

    const controlRef = doc(db, "user_sync", userId);

    this.changeListenerUnsubscribe = onSnapshot(
      controlRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const last = data?.lastChange?.toMillis?.() || 0;

        cacheService
          .getSyncMetadata(userId, "transactions")
          .then((meta) => {
            if (meta && last > meta.lastSync) {
              this.syncInBackground(userId, true, false, true);
            }
          });
      },
      console.error
    );
  }

  private async updateChangeMarker(userId: string) {
    await setDoc(
      doc(db, "user_sync", userId),
      { lastChange: serverTimestamp(), userId },
      { merge: true }
    );
  }

  // ========== FILA OFFLINE ==========
  private async enqueueOperation(params: {
    userId: string;
    collection: PendingCollection;
    action: "set" | "delete";
    docId: string;
    data?: any;
  }) {
    const op: PendingOperation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId: params.userId,
      collection: params.collection,
      action: params.action,
      docId: params.docId,
      data: params.data,
      timestamp: Date.now(),
    };

    await cacheService.addPendingOperation(op);
  }

  async syncPendingOperations(userId: string): Promise<void> {
    if (!this.isOnline) return;

    const ops = await cacheService.getPendingOperations(userId);
    if (ops.length === 0) return;

    for (const op of ops) {
      try {
        const ref = doc(db, op.collection, op.docId);

        if (op.action === "set") {
          await setDoc(ref, op.data!);
        } else {
          await deleteDoc(ref);
        }

        await cacheService.removePendingOperation(op.id);
      } catch (err) {
        console.error("Erro ao sincronizar operação pendente:", err);
        break;
      }
    }

    if (this.isOnline) await this.updateChangeMarker(userId);
  }

  // ========== CRUD OFFLINE/ONLINE ==========
  async saveTransaction(
    transaction: Transaction,
    userId: string
  ): Promise<void> {
    await cacheService.saveTransaction(transaction, userId);

    const data = { ...transaction, userId };

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "set",
        docId: transaction.id,
        data,
      });
    }

    try {
      await setDoc(doc(db, "transactions", transaction.id), data);
      await this.updateChangeMarker(userId);
    } catch (err) {
      await this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "set",
        docId: transaction.id,
        data,
      });
    }
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    await cacheService.deleteTransaction(id);

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "delete",
        docId: id,
      });
    }

    try {
      await deleteDoc(doc(db, "transactions", id));
      await this.updateChangeMarker(userId);
    } catch (err) {
      await this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "delete",
        docId: id,
      });
    }
  }

  async saveRecurringTransaction(
    transaction: RecurringTransaction,
    userId: string
  ): Promise<void> {
    await cacheService.saveRecurringTransaction(transaction, userId);

    const data = { ...transaction, userId };

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "set",
        docId: transaction.id,
        data,
      });
    }

    try {
      await setDoc(
        doc(db, "recurring_transactions", transaction.id),
        data
      );
      await this.updateChangeMarker(userId);
    } catch (err) {
      await this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "set",
        docId: transaction.id,
        data,
      });
    }
  }

  async deleteRecurringTransaction(
    id: string,
    userId: string
  ): Promise<void> {
    await cacheService.deleteRecurringTransaction(id);

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "delete",
        docId: id,
      });
    }

    try {
      await deleteDoc(doc(db, "recurring_transactions", id));
      await this.updateChangeMarker(userId);
    } catch (err) {
      await this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "delete",
        docId: id,
      });
    }
  }

  // ========== CLEANUP ==========
  cleanup() {
    if (this.changeListenerUnsubscribe) {
      this.changeListenerUnsubscribe();
      this.changeListenerUnsubscribe = null;
    }
    if (typeof window !== "undefined" && this.onlineListener) {
      window.removeEventListener("online", this.onlineListener);
      this.onlineListener = null;
    }
    this.currentUserId = null;
    this.onDataChange = null;
  }
}

// Singleton
export const syncService = new SyncService();
