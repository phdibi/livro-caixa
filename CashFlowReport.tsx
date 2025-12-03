import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from './types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

interface CashFlowReportProps {
  transactions: Transaction[];
}

type GroupBy = 'day' | 'week' | 'month';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const getWeekNumber = (date: Date): string => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
};

const isEntrada = (t: Transaction): boolean =>
  t.type === TransactionType.ENTRADA || t.type === 'Entrada';

const isSaida = (t: Transaction): boolean =>
  t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';

const CashFlowReport: React.FC<CashFlowReportProps> = ({ transactions }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('month');

  const chartData = useMemo(() => {
    const dataMap = new Map<
      string,
      { key: string; label: string; entrada: number; saida: number; saldo: number }
    >();

    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];

    // Ordenar transações por data
    const sorted = [...transactions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    sorted.forEach((t) => {
      const date = parseLocalDate(t.date);
      let key: string;
      let label: string;

      switch (groupBy) {
        case 'day':
          key = t.date;
          label = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          });
          break;
        case 'week':
          key = getWeekNumber(date);
          label = key.replace('-S', '/S');
          break;
        case 'month':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          label = `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
          break;
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, { key, label, entrada: 0, saida: 0, saldo: 0 });
      }

      const item = dataMap.get(key)!;
      if (isEntrada(t)) {
        item.entrada += t.amount;
      } else if (isSaida(t)) {
        item.saida += t.amount;
      }
    });

    // Calcular saldo e ordenar
    const result = Array.from(dataMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        ...item,
        saldo: item.entrada - item.saida,
      }));

    // Calcular saldo acumulado
    let acumulado = 0;
    result.forEach((item) => {
      acumulado += item.saldo;
      (item as any).acumulado = acumulado;
    });

    return result;
  }, [transactions, groupBy]);

  // Totais
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, item) => ({
        entradas: acc.entradas + item.entrada,
        saidas: acc.saidas + item.saida,
        saldo: acc.saldo + item.saldo,
      }),
      { entradas: 0, saidas: 0, saldo: 0 }
    );
  }, [chartData]);

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
        Nenhuma transação para exibir o fluxo de caixa.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Fluxo de Caixa
        </h3>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Agrupar por:
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded text-center">
          <p className="text-[10px] text-green-600 dark:text-green-400 uppercase">
            Entradas
          </p>
          <p className="text-sm font-bold text-green-700 dark:text-green-300">
            {formatCurrency(totals.entradas)}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-2 rounded text-center">
          <p className="text-[10px] text-red-600 dark:text-red-400 uppercase">
            Saídas
          </p>
          <p className="text-sm font-bold text-red-700 dark:text-red-300">
            {formatCurrency(totals.saidas)}
          </p>
        </div>
        <div
          className={`p-2 rounded text-center ${
            totals.saldo >= 0
              ? 'bg-blue-50 dark:bg-blue-900/30'
              : 'bg-orange-50 dark:bg-orange-900/30'
          }`}
        >
          <p
            className={`text-[10px] uppercase ${
              totals.saldo >= 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-orange-600 dark:text-orange-400'
            }`}
          >
            Saldo
          </p>
          <p
            className={`text-sm font-bold ${
              totals.saldo >= 0
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}
          >
            {formatCurrency(totals.saldo)}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
            interval={groupBy === 'day' ? 'preserveStartEnd' : 0}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#374151',
              border: 'none',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'entrada' ? 'Entradas' : name === 'saida' ? 'Saídas' : 'Saldo',
            ]}
          />
          <Legend
            formatter={(value) =>
              value === 'entrada' ? 'Entradas' : value === 'saida' ? 'Saídas' : 'Saldo'
            }
          />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="entrada" fill="#22c55e" name="entrada" />
          <Bar dataKey="saida" fill="#ef4444" name="saida" />
        </BarChart>
      </ResponsiveContainer>

      {/* Tabela resumida */}
      <div className="mt-4 max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left text-gray-600 dark:text-gray-400">
                Período
              </th>
              <th className="px-2 py-1 text-right text-green-600 dark:text-green-400">
                Entradas
              </th>
              <th className="px-2 py-1 text-right text-red-600 dark:text-red-400">
                Saídas
              </th>
              <th className="px-2 py-1 text-right text-gray-600 dark:text-gray-400">
                Saldo
              </th>
              <th className="px-2 py-1 text-right text-blue-600 dark:text-blue-400">
                Acumulado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {chartData.map((row) => (
              <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                <td className="px-2 py-1 text-gray-800 dark:text-gray-200">
                  {row.label}
                </td>
                <td className="px-2 py-1 text-right text-green-600 dark:text-green-400">
                  {formatCurrency(row.entrada)}
                </td>
                <td className="px-2 py-1 text-right text-red-600 dark:text-red-400">
                  {formatCurrency(row.saida)}
                </td>
                <td
                  className={`px-2 py-1 text-right font-medium ${
                    row.saldo >= 0
                      ? 'text-gray-800 dark:text-gray-200'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {formatCurrency(row.saldo)}
                </td>
                <td
                  className={`px-2 py-1 text-right ${
                    (row as any).acumulado >= 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {formatCurrency((row as any).acumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashFlowReport;
