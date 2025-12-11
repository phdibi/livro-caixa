import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Transaction, Account, isEntrada, isSaida } from './types';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { formatCurrency } from './utils/formatters';

interface CustomChartViewProps {
    transactions: Transaction[];
    accounts: Account[];
}

const formatCompact = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
    return formatCurrency(value);
};

// Paleta de cores mais harmoniosa
const COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f43f5e', // rose
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#a855f7', // purple
    '#d946ef', // fuchsia
];

const MultiSelectDropdown: React.FC<{
    accounts: Account[];
    selectedAccountIds: string[];
    onChange: (selectedIds: string[]) => void;
}> = ({ accounts, selectedAccountIds, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const handleSelect = (accountId: string) => {
        const newSelectedIds = selectedAccountIds.includes(accountId)
            ? selectedAccountIds.filter(id => id !== accountId)
            : [...selectedAccountIds, accountId];
        onChange(newSelectedIds);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-left text-sm"
            >
                {selectedAccountIds.length === 0 ? "Todas as Contas" : `${selectedAccountIds.length} conta(s)`}
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div
                        className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                        onClick={() => onChange([])}
                    >
                        Todas as Contas
                    </div>
                    {accounts.map(account => (
                        <div key={account.id} className="p-2 flex items-center text-sm">
                            <input
                                type="checkbox"
                                checked={selectedAccountIds.includes(account.id)}
                                onChange={() => handleSelect(account.id)}
                                className="mr-2"
                            />
                            <span className="truncate">{account.number} - {account.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Componente de legenda customizada - mais limpa e organizada
const CustomLegend: React.FC<{
    data: { name: string; value: number; color: string }[];
    total: number;
}> = ({ data, total }) => {
    const [showAll, setShowAll] = useState(false);
    const displayData = showAll ? data : data.slice(0, 6);
    const hasMore = data.length > 6;

    return (
        <div className="flex flex-col gap-1.5 text-xs max-h-[280px] overflow-y-auto pr-1">
            {displayData.map((item, index) => {
                const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                    <div key={index} className="flex items-center gap-2 py-1">
                        <span
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300" title={item.name}>
                            {item.name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {percent}%
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                            {formatCompact(item.value)}
                        </span>
                    </div>
                );
            })}
            {hasMore && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-left mt-1"
                >
                    {showAll ? '← Mostrar menos' : `+${data.length - 6} mais...`}
                </button>
            )}
        </div>
    );
};

// Tooltip customizado
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
                <p className="font-medium">{data.name}</p>
                <p className="text-gray-300">{formatCurrency(data.value)}</p>
            </div>
        );
    }
    return null;
};

const CustomChartView: React.FC<CustomChartViewProps> = ({ transactions, accounts }) => {
    const [metric, setMetric] = useState<'Entradas' | 'Saidas' | 'Margem'>('Saidas');
    const [groupBy, setGroupBy] = useState<'conta' | 'mes'>('conta');
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [chartType, setChartType] = useState<'pizza' | 'barras'>('pizza');

    const { chartData, total } = useMemo(() => {
        const filteredByAccount = selectedAccountIds.length > 0
            ? transactions.filter(t => accounts.find(a => a.number === t.accountNumber && selectedAccountIds.includes(a.id)))
            : transactions;

        const dataMap: { [key: string]: { name: string, Entrada: number, Saida: number } } = {};

        if (groupBy === 'mes') {
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            filteredByAccount.forEach(t => {
                const date = new Date(t.date + 'T00:00:00');
                const month = date.getMonth();
                const year = date.getFullYear();
                const key = `${year}-${String(month).padStart(2, '0')}`;
                if (!dataMap[key]) {
                    dataMap[key] = { name: `${monthNames[month]}/${year.toString().slice(-2)}`, Entrada: 0, Saida: 0 };
                }
                if (isEntrada(t)) {
                    dataMap[key].Entrada += t.amount;
                } else if (isSaida(t)) {
                    dataMap[key].Saida += t.amount;
                }
            });
        } else {
            filteredByAccount.forEach(t => {
                const key = t.accountName;
                if (!dataMap[key]) {
                    dataMap[key] = { name: key, Entrada: 0, Saida: 0 };
                }
                if (isEntrada(t)) {
                    dataMap[key].Entrada += t.amount;
                } else if (isSaida(t)) {
                    dataMap[key].Saida += t.amount;
                }
            });
        }
        
        let processedData = Object.values(dataMap);

        if (groupBy === 'mes') {
            processedData = Object.entries(dataMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, value]) => value);
        }

        let finalData: { name: string; value: number }[];
        if (metric === 'Entradas') {
            finalData = processedData.map(d => ({ name: d.name, value: d.Entrada })).filter(d => d.value > 0);
        } else if (metric === 'Saidas') {
            finalData = processedData.map(d => ({ name: d.name, value: d.Saida })).filter(d => d.value > 0);
        } else {
            finalData = processedData.map(d => ({ name: d.name, value: d.Entrada - d.Saida }));
        }

        // Ordenar por valor (maior primeiro) para pizza
        if (chartType === 'pizza') {
            finalData.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
        }

        const total = finalData.reduce((sum, item) => sum + Math.abs(item.value), 0);

        return { chartData: finalData, total };
    }, [transactions, accounts, metric, groupBy, selectedAccountIds, chartType]);

    const dataWithColors = chartData.map((item, index) => ({
        ...item,
        color: COLORS[index % COLORS.length]
    }));

    const chartTitle = `${metric} por ${groupBy === 'conta' ? 'Conta' : 'Mês'}`;
    const barColor = metric === 'Entradas' ? '#22c55e' : metric === 'Saidas' ? '#ef4444' : '#3b82f6';

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{chartTitle}</h3>
                
                {/* Toggle Pizza/Barras */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                        onClick={() => setChartType('pizza')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            chartType === 'pizza'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Pizza
                    </button>
                    <button
                        onClick={() => setChartType('barras')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            chartType === 'barras'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Barras
                    </button>
                </div>
            </div>

            {/* Filtros em linha */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Métrica</label>
                    <select 
                        value={metric} 
                        onChange={e => setMetric(e.target.value as any)} 
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="Saidas">Saídas</option>
                        <option value="Entradas">Entradas</option>
                        <option value="Margem">Margem</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Agrupar por</label>
                    <select 
                        value={groupBy} 
                        onChange={e => setGroupBy(e.target.value as any)} 
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="conta">Conta</option>
                        <option value="mes">Mês</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Filtrar Contas</label>
                    <MultiSelectDropdown
                        accounts={accounts}
                        selectedAccountIds={selectedAccountIds}
                        onChange={setSelectedAccountIds}
                    />
                </div>
            </div>

            {/* Área do Gráfico */}
            {chartData.length > 0 ? (
                chartType === 'pizza' ? (
                    /* Layout PIZZA - Responsivo */
                    <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
                        {/* Gráfico Pizza */}
                        <div className="w-full lg:w-1/2 flex justify-center">
                            <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dataWithColors}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {dataWithColors.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Legenda + Total */}
                        <div className="w-full lg:w-1/2 flex flex-col gap-4">
                            {/* Total destaque */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center lg:text-left">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(total)}
                                </p>
                            </div>
                            
                            {/* Legenda */}
                            <CustomLegend data={dataWithColors} total={total} />
                        </div>
                    </div>
                ) : (
                    /* Layout BARRAS */
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                            <XAxis 
                                dataKey="name" 
                                stroke="#9ca3af" 
                                tick={{ fontSize: 11 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis stroke="#9ca3af" tickFormatter={(v) => formatCompact(v)} width={70} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} 
                                labelStyle={{ color: '#d1d5db' }} 
                                formatter={(value: number) => formatCurrency(value)} 
                            />
                            <Bar dataKey="value" fill={barColor} name={metric} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )
            ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p>Nenhum dado para exibir</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomChartView;