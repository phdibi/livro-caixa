
export enum TransactionType {
  ENTRADA = 'Entrada',
  SAIDA = 'Saida',
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  accountNumber: number;
  accountName: string;
  description: string;
  quantity?: number;
  unitValue?: number;
  amount: number;
  payee: string; // Fornecedor / Comprador
  paymentMethod: string;
  seriesId?: string; // Para agrupar parcelas
}

export interface Account {
  id: string;
  number: number;
  name: string;
  type: 'Receita' | 'Despesa';
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
}