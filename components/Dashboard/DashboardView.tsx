import React, { lazy, Suspense } from 'react';
import { Transaction, Account } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { LoadingSpinner } from '../UI/LoadingSpinner';

const CustomChartView = lazy(() => import('../../CustomChartView'));

interface DashboardViewProps {
    totalEntradas: number;
    totalSaidas: number;
    margem: number;
    filteredTransactions: Transaction[];
    accounts: Account[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
    totalEntradas,
    totalSaidas,
    margem,
    filteredTransactions,
    accounts,
}) => {
    return (
        <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Entradas</p>
                    <p className="mt-2 text-2xl font-bold text-green-600">
                        {formatCurrency(totalEntradas)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Saídas</p>
                    <p className="mt-2 text-2xl font-bold text-red-600">
                        {formatCurrency(totalSaidas)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Margem</p>
                    <p
                        className={`mt-2 text-2xl font-bold ${margem >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                    >
                        {formatCurrency(margem)}
                    </p>
                </div>
            </div>
            <Suspense fallback={<LoadingSpinner />}>
                <CustomChartView transactions={filteredTransactions} accounts={accounts} />
            </Suspense>
        </div>
    );
};
