import { Transaction, TransactionType } from './types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Funções auxiliares de data
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validação de transação
export function validateTransaction(
  transaction: Partial<Transaction>,
  existingTransactions: Transaction[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Data obrigatória
  if (!transaction.date) {
    errors.push({
      field: 'date',
      message: 'Data é obrigatória',
      severity: 'error',
    });
  } else {
    const transDate = parseLocalDate(transaction.date);

    // REMOVIDO: Warning de data futura - usuário pode lançar contas futuras livremente

    // Data muito antiga - warning
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (transDate < twoYearsAgo) {
      warnings.push({
        field: 'date',
        message: 'Data é de mais de 2 anos atrás. Confirma?',
        severity: 'warning',
      });
    }
  }

  // Valor
  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push({
      field: 'amount',
      message: 'Valor é obrigatório',
      severity: 'error',
    });
  } else if (transaction.amount < 0) {
    errors.push({
      field: 'amount',
      message: 'Valor não pode ser negativo',
      severity: 'error',
    });
  } else if (transaction.amount === 0) {
    warnings.push({
      field: 'amount',
      message: 'Valor é zero. Confirma?',
      severity: 'warning',
    });
  } else if (transaction.amount > 1000000) {
    warnings.push({
      field: 'amount',
      message: 'Valor muito alto. Verifique se está correto.',
      severity: 'warning',
    });
  }

  // Descrição
  if (!transaction.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Histórico é obrigatório',
      severity: 'error',
    });
  }

  // Conta
  if (!transaction.accountNumber) {
    errors.push({
      field: 'accountNumber',
      message: 'Conta é obrigatória',
      severity: 'error',
    });
  }

  // Verificar duplicata
  if (
    transaction.date &&
    transaction.amount &&
    transaction.description &&
    transaction.accountNumber
  ) {
    const isDuplicate = existingTransactions.some(
      (t) =>
        t.id !== transaction.id && // Não comparar consigo mesmo
        t.date === transaction.date &&
        t.amount === transaction.amount &&
        t.accountNumber === transaction.accountNumber &&
        t.description === transaction.description
    );

    if (isDuplicate) {
      warnings.push({
        field: 'duplicate',
        message: 'Já existe um lançamento idêntico. Pode ser duplicado.',
        severity: 'warning',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Parse de data em formato brasileiro
export function parseBrazilianDate(input: string): string | null {
  // Aceita: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  const match = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  
  if (match) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    // Validar valores
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  
  return null;
}

// Formatador de moeda
export function parseCurrencyInput(input: string): number {
  // Remove R$, espaços e pontos de milhar, substitui vírgula por ponto
  const cleaned = input
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
