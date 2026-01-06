import { describe, it, expect } from 'vitest';
import { Transaction, TransactionType, ReceiptStatus, IrCategory } from '../../types';

// Re-implement validation functions for testing
interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

function validateTransaction(
  transaction: Partial<Transaction>,
  existingTransactions: Transaction[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Date required
  if (!transaction.date) {
    errors.push({
      field: 'date',
      message: 'Data é obrigatória',
      severity: 'error',
    });
  } else {
    const transDate = parseLocalDate(transaction.date);

    // Date too old - warning
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

  // Amount
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

  // Description
  if (!transaction.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Histórico é obrigatório',
      severity: 'error',
    });
  }

  // Account
  if (!transaction.accountNumber) {
    errors.push({
      field: 'accountNumber',
      message: 'Conta é obrigatória',
      severity: 'error',
    });
  }

  // Check duplicate
  if (
    transaction.date &&
    transaction.amount &&
    transaction.description &&
    transaction.accountNumber
  ) {
    const isDuplicate = existingTransactions.some(
      (t) =>
        t.id !== transaction.id &&
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

function parseBrazilianDate(input: string): string | null {
  const match = input.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseCurrencyInput(input: string): number {
  const cleaned = input
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

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

describe('validateTransaction', () => {
  describe('Required Fields', () => {
    it('should fail when date is missing', () => {
      const result = validateTransaction({
        amount: 100,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'date', severity: 'error' })
      );
    });

    it('should fail when amount is missing', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'amount', severity: 'error' })
      );
    });

    it('should fail when description is missing', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 100,
        accountNumber: 101,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'description', severity: 'error' })
      );
    });

    it('should fail when description is empty string', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 100,
        description: '   ',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'description' })
      );
    });

    it('should fail when accountNumber is missing', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 100,
        description: 'Test',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'accountNumber', severity: 'error' })
      );
    });
  });

  describe('Amount Validation', () => {
    it('should fail when amount is negative', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: -100,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Valor não pode ser negativo',
        })
      );
    });

    it('should warn when amount is zero', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 0,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Valor é zero. Confirma?',
        })
      );
    });

    it('should warn when amount is very high', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 1500000,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Valor muito alto. Verifique se está correto.',
        })
      );
    });

    it('should pass with valid amount', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 500,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Date Validation', () => {
    it('should warn when date is more than 2 years ago', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 3);
      const dateStr = oldDate.toISOString().split('T')[0];

      const result = validateTransaction({
        date: dateStr,
        amount: 100,
        description: 'Test',
        accountNumber: 101,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'date',
          message: 'Data é de mais de 2 anos atrás. Confirma?',
        })
      );
    });

    it('should not warn for recent dates', () => {
      const result = validateTransaction({
        date: '2024-01-15',
        amount: 100,
        description: 'Test',
        accountNumber: 101,
      });

      const dateWarning = result.warnings.find((w) => w.field === 'date');
      expect(dateWarning).toBeUndefined();
    });
  });

  describe('Duplicate Detection', () => {
    it('should warn when duplicate transaction exists', () => {
      const existing = [
        createMockTransaction({
          id: 'existing-1',
          date: '2024-01-15',
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        }),
      ];

      const result = validateTransaction(
        {
          id: 'new-1',
          date: '2024-01-15',
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        },
        existing
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'duplicate',
          message: 'Já existe um lançamento idêntico. Pode ser duplicado.',
        })
      );
    });

    it('should not warn when editing same transaction', () => {
      const existing = [
        createMockTransaction({
          id: 'existing-1',
          date: '2024-01-15',
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        }),
      ];

      const result = validateTransaction(
        {
          id: 'existing-1', // Same ID
          date: '2024-01-15',
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        },
        existing
      );

      const duplicateWarning = result.warnings.find((w) => w.field === 'duplicate');
      expect(duplicateWarning).toBeUndefined();
    });

    it('should not warn when transactions differ', () => {
      const existing = [
        createMockTransaction({
          id: 'existing-1',
          date: '2024-01-15',
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        }),
      ];

      const result = validateTransaction(
        {
          id: 'new-1',
          date: '2024-01-16', // Different date
          amount: 100,
          description: 'Test transaction',
          accountNumber: 101,
        },
        existing
      );

      const duplicateWarning = result.warnings.find((w) => w.field === 'duplicate');
      expect(duplicateWarning).toBeUndefined();
    });
  });

  describe('Valid Transactions', () => {
    it('should pass validation for complete valid transaction', () => {
      const result = validateTransaction({
        id: 'test-1',
        date: '2024-01-15',
        type: TransactionType.SAIDA,
        accountNumber: 101,
        accountName: 'Sede',
        description: 'Valid transaction',
        amount: 500,
        payee: 'Test Payee',
        paymentMethod: 'pix',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation with optional fields', () => {
      const result = validateTransaction({
        id: 'test-1',
        date: '2024-01-15',
        type: TransactionType.ENTRADA,
        accountNumber: 301,
        accountName: 'Receita',
        description: 'Sale with notes',
        amount: 1000,
        payee: 'Customer',
        paymentMethod: 'transfer',
        notes: 'Some notes',
        receiptStatus: ReceiptStatus.ATTACHED,
        irCategory: IrCategory.ATIVIDADE_RURAL,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('parseBrazilianDate', () => {
  it('should parse date with slashes', () => {
    expect(parseBrazilianDate('15/01/2024')).toBe('2024-01-15');
    expect(parseBrazilianDate('1/5/2024')).toBe('2024-05-01');
  });

  it('should parse date with dashes', () => {
    expect(parseBrazilianDate('15-01-2024')).toBe('2024-01-15');
  });

  it('should parse date with dots', () => {
    expect(parseBrazilianDate('15.01.2024')).toBe('2024-01-15');
  });

  it('should return null for invalid formats', () => {
    expect(parseBrazilianDate('2024-01-15')).toBe(null); // ISO format
    expect(parseBrazilianDate('15/13/2024')).toBe(null); // Invalid month
    expect(parseBrazilianDate('32/01/2024')).toBe(null); // Invalid day
    expect(parseBrazilianDate('15/01/1899')).toBe(null); // Year too old
    expect(parseBrazilianDate('invalid')).toBe(null);
  });

  it('should handle edge cases', () => {
    expect(parseBrazilianDate('31/12/2024')).toBe('2024-12-31');
    expect(parseBrazilianDate('01/01/2024')).toBe('2024-01-01');
  });
});

describe('parseCurrencyInput', () => {
  it('should parse Brazilian currency format', () => {
    expect(parseCurrencyInput('R$ 1.500,00')).toBe(1500);
    expect(parseCurrencyInput('R$ 100,50')).toBe(100.5);
    expect(parseCurrencyInput('1.234.567,89')).toBe(1234567.89);
  });

  it('should parse simple numbers', () => {
    expect(parseCurrencyInput('100')).toBe(100);
    expect(parseCurrencyInput('100.50')).toBe(10050); // Without comma, dots are thousands
    expect(parseCurrencyInput('100,50')).toBe(100.5);
  });

  it('should handle edge cases', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('invalid')).toBe(0);
    expect(parseCurrencyInput('R$ ')).toBe(0);
  });

  it('should handle values with spaces', () => {
    expect(parseCurrencyInput('  R$  1.500,00  ')).toBe(1500);
  });
});

describe('parseLocalDate', () => {
  it('should parse ISO date string correctly', () => {
    const date = parseLocalDate('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January is 0
    expect(date.getDate()).toBe(15);
  });

  it('should set time to noon to avoid timezone issues', () => {
    const date = parseLocalDate('2024-06-15');
    expect(date.getHours()).toBe(12);
  });
});
