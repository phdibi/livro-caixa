import { ReceiptStatus, IrCategory } from '../types';

export const receiptStatusLabel = (status?: ReceiptStatus) => {
    const labels: Record<string, string> = {
        [ReceiptStatus.HAS_BUT_NOT_ATTACHED]: 'Tenho, mas não anexei',
        [ReceiptStatus.ATTACHED]: 'Comp. anexado',
        [ReceiptStatus.LOST]: 'Perdi o comp.',
        [ReceiptStatus.NOT_REQUIRED]: 'Isento de comp.',
    };
    return labels[status || ''] || 's/ comprovante';
};

export const receiptStatusClasses = (status?: ReceiptStatus) => {
    const classes: Record<string, string> = {
        [ReceiptStatus.ATTACHED]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
        [ReceiptStatus.HAS_BUT_NOT_ATTACHED]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
        [ReceiptStatus.LOST]: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
        [ReceiptStatus.NOT_REQUIRED]: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200',
    };
    return classes[status || ''] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
};

export const irCategoryLabel = (cat?: IrCategory) => {
    const labels: Record<string, string> = {
        [IrCategory.SAUDE]: 'Saúde',
        [IrCategory.EDUCACAO]: 'Educação',
        [IrCategory.LIVRO_CAIXA]: 'Livro caixa',
        [IrCategory.CARNE_LEAO]: 'Carnê-Leão',
        [IrCategory.ALUGUEL]: 'Aluguel',
        [IrCategory.BEM_DIREITO]: 'Bens e direitos',
        [IrCategory.ATIVIDADE_RURAL]: 'Atividade Rural',
        [IrCategory.OUTRA]: 'Outra',
        [IrCategory.NAO_DEDUTIVEL]: 'Não dedutível / geral',
    };
    return labels[cat || ''] || 'Não classificado';
};
