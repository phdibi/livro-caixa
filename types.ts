export enum TransactionType {
  ENTRADA = 'Entrada',
  SAIDA = 'Saida',
}

export enum ReceiptStatus {
  NONE = 'none',
  HAS_BUT_NOT_ATTACHED = 'has_but_not_attached',
  ATTACHED = 'attached',
  LOST = 'lost',
  NOT_REQUIRED = 'not_required',
}

export enum IrCategory {
  NAO_DEDUTIVEL = 'nao_dedutivel',
  SAUDE = 'saude',
  EDUCACAO = 'educacao',
  LIVRO_CAIXA = 'livro_caixa',
  CARNE_LEAO = 'carne_leao',
  ALUGUEL = 'aluguel',
  BEM_DIREITO = 'bem_direito',
  ATIVIDADE_RURAL = 'atividade_rural',
  OUTRA = 'outra',
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType | string; // string para compatibilidade com dados antigos
  accountNumber: number;
  accountName: string;
  description: string;
  quantity?: number;
  unitValue?: number;
  amount: number;
  payee: string; // Fornecedor / Comprador
  paymentMethod: string;
  seriesId?: string; // Para agrupar parcelas
  invoiceId?: string; // Para agrupar itens de uma mesma nota fiscal
  notes?: string;
  receiptStatus?: ReceiptStatus;
  irCategory?: IrCategory;
  irNotes?: string;
  isContaTiti?: boolean;
  updatedAt?: number;
  createdAt?: number;
  // Campos para comprovantes anexados
  receiptUrl?: string; // URL do arquivo no Firebase Storage
  receiptFilename?: string; // Nome original do arquivo
  receiptUploadedAt?: number; // Timestamp do upload
}

export interface Account {
  id: string;
  number: number;
  name: string;
  type: 'Receita' | 'Despesa';
  updatedAt?: number;
  createdAt?: number;
}

export interface RecurringTransaction {
  id: string;
  dayOfMonth: number;
  type: TransactionType;
  accountNumber: number;
  accountName: string;
  description: string;
  amount: number;
  payee: string;
  paymentMethod: string;
  // Campos de IR para contas fixas
  irCategory?: IrCategory;
  requiresReceipt?: boolean;
  isContaTiti?: boolean;
  updatedAt?: number;
  createdAt?: number;
}

// Helpers de tipo
export const isEntrada = (t: Transaction): boolean =>
  t.type === TransactionType.ENTRADA || t.type === 'Entrada';

export const isSaida = (t: Transaction): boolean =>
  t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';

export interface SavePayload {
  transaction: Transaction;
  installmentsCount?: number;
  firstInstallmentDate?: string;
  updateScope?: 'single' | 'future';
}