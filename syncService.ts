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

// ======== CONTAS PADRÃO ========
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

// ======== HELPERS ========
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

// ======== SERVICE ========
class SyncService {
  private changeListenerUnsubscribe: Unsubscribe | null = null;
  private currentUserId: string | null = null;
  private onDataChange: (() => void) | null = null;

  // NOVO: Callback do snackbar
  private onSyncSuccess: (() => void) | null = null;

  setSyncSuccessCallback(cb: () => void) {
    this.onSyncSuccess = cb;
  }

  private get isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  }

  // ======== INIT ========
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

    const trx = await cacheService.getTransactions(userId);
    const acc = await cacheService.getAccounts(userId);
    const rec = await cacheService.getRecurringTransactions(userId);

    if (this.isOnline) {
      await this.syncPendingOperations(userId);
    }

    this.setupChangeListener(userId);

    return { transactions: trx, accounts: acc, recurringTransactions: rec };
  }

  // ======== ONLINE LISTENER ========
  private setupChangeListener(userId: string) {
    if (this.changeListenerUnsubscribe)
      this.changeListenerUnsubscribe();

    const ref = doc(db, "user_sync", userId);

    this.changeListenerUnsubscribe = onSnapshot(ref, async () => {
      if (this.onSyncSuccess) this.onSyncSuccess();
      this.syncInBackground(userId);
    });
  }

  private async updateChangeMarker(userId: string) {
    await setDoc(
      doc(db, "user_sync", userId),
      { lastChange: serverTimestamp(), userId },
      { merge: true }
    );
  }

  // ======== FILA OFFLINE ========
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

  async syncPendingOperations(userId: string) {
    if (!this.isOnline) return;

    const ops = await cacheService.getPendingOperations(userId);
    if (ops.length === 0) return;

    for (const op of ops) {
      try {
        const ref = doc(db, op.collection, op.docId);

        if (op.action === "set") {
          await setDoc(ref, op.data);
        } else {
          await deleteDoc(ref);
        }

        await cacheService.removePendingOperation(op.id);
      } catch {
        break;
      }
    }

    if (this.onSyncSuccess) this.onSyncSuccess();
    await this.updateChangeMarker(userId);
  }

  // ======== CRUD OFFLINE/ONLINE ========
  async saveTransaction(trx: Transaction, userId: string) {
    await cacheService.saveTransaction(trx, userId);

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "set",
        docId: trx.id,
        data: { ...trx, userId },
      });
    }

    try {
      await setDoc(doc(db, "transactions", trx.id), {
        ...trx,
        userId,
      });
      if (this.onSyncSuccess) this.onSyncSuccess();
      await this.updateChangeMarker(userId);
    } catch {
      await this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "set",
        docId: trx.id,
        data: { ...trx, userId },
      });
    }
  }

  async deleteTransaction(id: string, userId: string) {
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
      if (this.onSyncSuccess) this.onSyncSuccess();
      await this.updateChangeMarker(userId);
    } catch {
      await this.enqueueOperation({
        userId,
        collection: "transactions",
        action: "delete",
        docId: id,
      });
    }
  }

  async saveRecurringTransaction(tr: RecurringTransaction, userId: string) {
    await cacheService.saveRecurringTransaction(tr, userId);

    if (!this.isOnline) {
      return this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "set",
        docId: tr.id,
        data: { ...tr, userId },
      });
    }

    try {
      await setDoc(doc(db, "recurring_transactions", tr.id), {
        ...tr,
        userId,
      });
      if (this.onSyncSuccess) this.onSyncSuccess();
      await this.updateChangeMarker(userId);
    } catch {
      await this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "set",
        docId: tr.id,
        data: { ...tr, userId },
      });
    }
  }

  async deleteRecurringTransaction(id: string, userId: string) {
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
      if (this.onSyncSuccess) this.onSyncSuccess();
      await this.updateChangeMarker(userId);
    } catch {
      await this.enqueueOperation({
        userId,
        collection: "recurring_transactions",
        action: "delete",
        docId: id,
      });
    }
  }

  cleanup() {
    if (this.changeListenerUnsubscribe)
      this.changeListenerUnsubscribe();
    this.currentUserId = null;
    this.onDataChange = null;
  }
}

export const syncService = new SyncService();
