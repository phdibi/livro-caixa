export enum TransactionType {
  ENTRADA = 'Entrada',
  SAIDA = 'Saida',
}

/**
 * Status do comprovante fiscal vinculado ao lançamento.
 * Usado para o fluxo de Imposto de Renda.
 *
 * - NONE: não existe nota/comprovante para este lançamento
 * - HAS_BUT_NOT_ATTACHED: o usuário tem o comprovante, mas ainda não anexou no sistema
 * - ATTACHED: comprovante anexado (com metadata nos campos de recibo)
 */
export enum ReceiptStatus {
  NONE = 'none',                      // Não informado / não tenho comprovante
  HAS_BUT_NOT_ATTACHED = 'has-but-not-attached', // Tenho mas não anexei
  ATTACHED = 'attached',              // Anexei o arquivo
  LOST = 'lost',                      // Tinha mas perdi
  NOT_REQUIRED = 'not-required',      // Isento de comprovante
}

/**
 * Classificação fiscal usada para geração de relatórios de IR.
 * Estes valores são técnicos; a interface pode exibir rótulos mais amigáveis.
 */
export enum IrCategory {
  NAO_DEDUTIVEL = 'nao-dedutivel',
  SAUDE = 'saude',
  EDUCACAO = 'educacao',
  LIVRO_CAIXA = 'livro-caixa',
  ALUGUEL = 'aluguel',
  BEM_DIREITO = 'bem-direito',
  ATIVIDADE_RURAL = 'atividade-rural',
  OUTRA = 'outra',
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

  /**
   * Identificador de série de parcelas.
   * Todas as parcelas de uma mesma compra parcelada compartilham o mesmo seriesId.
   */
  seriesId?: string;

  /**
   * Identificador lógico de uma "nota" ou "lançamento agrupado".
   * Pode ser usado para agrupar diversos itens da mesma NF.
   */
  invoiceId?: string;

  /**
   * Status do comprovante fiscal vinculado (checkbox de 3 estados na UI).
   * Se não informado, deve ser tratado na aplicação como ReceiptStatus.NONE.
   */
  receiptStatus?: ReceiptStatus;

  /**
   * Metadados opcionais do arquivo de comprovante armazenado (ex.: Firebase Storage).
   * Estes campos são preenchidos quando receiptStatus === ReceiptStatus.ATTACHED.
   */
  receiptStoragePath?: string;
  receiptDownloadUrl?: string;
  receiptFileName?: string;
  receiptContentType?: string;

  /**
   * Classificação fiscal do lançamento, para fins de relatório de IRPF.
   */
  irCategory?: IrCategory;

  /**
   * Observações livres relacionadas ao imposto de renda
   * (ex.: "Consulta particular do dependente X", "Curso do dependente Y").
   */
  irNotes?: string;
}

export interface Account {
  id: string;
  number: number;
  name: string;
  type: 'Receita' | 'Despesa';
}

/**
 * Modelo de conta fixa (lançamento recorrente).
 * Alguns campos de IR podem ser usados como padrão ao gerar os lançamentos do mês.
 */
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

  /**
   * Categoria fiscal padrão para os lançamentos gerados a partir desta recorrência.
   * Ex.: plano de saúde, escola, aluguel etc.
   */
  irCategory?: IrCategory;

  /**
   * Indica se, em regra, esta conta fixa exige nota/comprovante
   * (apenas diretriz; o controle real continua em cada Transaction).
   */
  requiresReceipt?: boolean;
}
