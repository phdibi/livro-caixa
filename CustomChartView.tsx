import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, Account, TransactionType } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface CustomChartViewProps {
    transactions: Transaction[];
    accounts: Account[];
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943', '#19D4FF', '#82ca9d', '#8884d8', '#ffc658'];

// Helper para comparação robusta de tipo (enum ou string literal)
const isEntrada = (t: Transaction): boolean => {
    return t.type === TransactionType.ENTRADA || t.type === 'Entrada';
};

const isSaida = (t: Transaction): boolean => {
    return t.type === TransactionType.SAIDA || t.type === 'Saida' || t.type === 'Saída';
};

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
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-left"
            >
                {selectedAccountIds.length === 0 ? "Todas as Contas" : `${selectedAccountIds.length} conta(s) selecionada(s)`}
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div
                        className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => onChange([])}
                    >
                        Todas as Contas
                    </div>
                    {accounts.map(account => (
                        <div key={account.id} className="p-2 flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedAccountIds.includes(account.id)}
                                onChange={() => handleSelect(account.id)}
                                className="mr-2"
                            />
                            <span>{account.number} - {account.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const CustomChartView: React.FC<CustomChartViewProps> = ({ transactions, accounts }) => {
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [metric, setMetric] = useState<'Entradas' | 'Saidas' | 'Margem'>('Saidas');
    const [groupBy, setGroupBy] = useState<'conta' | 'mes'>('conta');
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

    const chartData = useMemo(() => {
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
                // CORRIGIDO: Usando helpers robustos
                if (isEntrada(t)) {
                    dataMap[key].Entrada += t.amount;
                } else if (isSaida(t)) {
                    dataMap[key].Saida += t.amount;
                }
            });
        } else { // groupBy === 'conta'
            filteredByAccount.forEach(t => {
                const key = t.accountName;
                if (!dataMap[key]) {
                    dataMap[key] = { name: key, Entrada: 0, Saida: 0 };
                }
                // CORRIGIDO: Usando helpers robustos
                if (isEntrada(t)) {
                    dataMap[key].Entrada += t.amount;
                } else if (isSaida(t)) {
                    dataMap[key].Saida += t.amount;
                }
            });
        }
        
        let processedData = Object.values(dataMap);

        // Ordenar por chave se agrupado por mês
        if (groupBy === 'mes') {
            processedData = Object.entries(dataMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, value]) => value);
        }

        if (metric === 'Entradas') {
            return processedData.map(d => ({ name: d.name, Valor: d.Entrada })).filter(d => d.Valor > 0);
        }
        if (metric === 'Saidas') {
            return processedData.map(d => ({ name: d.name, Valor: d.Saida })).filter(d => d.Valor > 0);
        }
        // Margem
        return processedData.map(d => ({ name: d.name, Valor: d.Entrada - d.Saida }));

    }, [transactions, accounts, metric, groupBy, selectedAccountIds]);
    
    const chartTitle = `${metric} por ${groupBy === 'conta' ? 'Conta' : 'Mês'}`;
    const barColor = metric === 'Entradas' ? '#22c55e' : metric === 'Saidas' ? '#ef4444' : '#3b82f6';

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">{chartTitle}</h3>
                
                {/* Toggle tipo de gráfico */}
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                        onClick={() => setChartType('bar')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            chartType === 'bar'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                        }`}
                    >
                        <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Barras
                    </button>
                    <button
                        onClick={() => setChartType('pie')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            chartType === 'pie'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                        }`}
                    >
                        <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                        Pizza
                    </button>
                </div>
            </div>
            
            <div className="my-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Métrica</label>
                    <select value={metric} onChange={e => setMetric(e.target.value as any)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="Saidas">Saídas</option>
                        <option value="Entradas">Entradas</option>
                        <option value="Margem">Margem</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Agrupar por</label>
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="conta">Conta</option>
                        <option value="mes">Mês</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar Contas</label>
                    <MultiSelectDropdown
                        accounts={accounts}
                        selectedAccountIds={selectedAccountIds}
                        onChange={setSelectedAccountIds}
                    />
                </div>
            </div>

            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#9ca3af" tickFormatter={formatCurrency} />
                            <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none' }} labelStyle={{ color: '#d1d5db' }} formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="Valor" fill={barColor} name={metric} />
                        </BarChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={chartData.filter(d => d.Valor > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name.length > 15 ? name.substring(0, 15) + '...' : name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="Valor"
                            >
                                {chartData.filter(d => d.Valor > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#374151', border: 'none' }} 
                                labelStyle={{ color: '#d1d5db' }} 
                                formatter={(value: number) => formatCurrency(value)} 
                            />
                            <Legend />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                    Nenhum dado para exibir com os filtros selecionados.
                </div>
            )}
        </div>
    );
};

export default CustomChartView;