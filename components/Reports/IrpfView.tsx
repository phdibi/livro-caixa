import React from 'react';
import { Transaction, IrCategory } from '../../types';
import {
    formatCurrency,
    formatDisplayDate,
} from '../../utils/formatters';
import { irCategoryLabel } from '../../utils/labels';

interface IrpfResumo {
    resumoArray: { categoria: string | IrCategory; total: number; count: number }[];
    pendentesComprovante: Transaction[];
}

interface IrpfViewProps {
    irpfResumo: IrpfResumo;
}

export const IrpfView: React.FC<IrpfViewProps> = ({ irpfResumo }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mt-4 p-4 space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-1">
                    Resumo para Imposto de Renda
                </h2>
                <p className="text-xs text-gray-500">
                    Valores conforme filtros aplicados.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/70">
                        <tr>
                            <th className="px-3 py-2 text-left text-gray-500">Categoria</th>
                            <th className="px-3 py-2 text-right text-gray-500">Qtd</th>
                            <th className="px-3 py-2 text-right text-gray-500">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {irpfResumo.resumoArray.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                                    Nenhum lançamento relevante.
                                </td>
                            </tr>
                        )}
                        {irpfResumo.resumoArray.map((row) => (
                            <tr key={row.categoria}>
                                <td className="px-3 py-2">
                                    {irCategoryLabel(row.categoria as IrCategory)}
                                </td>
                                <td className="px-3 py-2 text-right">{row.count}</td>
                                <td className="px-3 py-2 text-right font-semibold">
                                    {formatCurrency(row.total)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {irpfResumo.pendentesComprovante.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-2">
                        Pendências de comprovante ({irpfResumo.pendentesComprovante.length})
                    </h3>
                    <div className="overflow-x-auto max-h-48">
                        <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900/70 sticky top-0">
                                <tr>
                                    <th className="px-2 py-1 text-left">Data</th>
                                    <th className="px-2 py-1 text-left">Descrição</th>
                                    <th className="px-2 py-1 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {irpfResumo.pendentesComprovante.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-2 py-1">{formatDisplayDate(t.date)}</td>
                                        <td className="px-2 py-1">{t.description}</td>
                                        <td className="px-2 py-1 text-right">
                                            {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
