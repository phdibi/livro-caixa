
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, Account, TransactionType } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CustomChartViewProps {
    transactions: Transaction[];
    accounts: Account[];
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                const key = `${year}-${month}`;
                if (!dataMap[key]) {
                    dataMap[key] = { name: `${monthNames[month]}/${year.toString().slice(-2)}`, Entrada: 0, Saida: 0 };
                }
                if (t.type === TransactionType.ENTRADA) dataMap[key].Entrada += t.amount;
                else dataMap[key].Saida += t.amount;
            });
        } else { // groupBy === 'conta'
            filteredByAccount.forEach(t => {
                const key = t.accountName;
                if (!dataMap[key]) {
                    dataMap[key] = { name: key, Entrada: 0, Saida: 0 };
                }
                if (t.type === TransactionType.ENTRADA) dataMap[key].Entrada += t.amount;
                else dataMap[key].Saida += t.amount;
            });
        }
        
        let processedData = Object.values(dataMap);

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
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{chartTitle}</h3>
            
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
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                        <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#9ca3af" tickFormatter={formatCurrency} />
                        <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none' }} labelStyle={{ color: '#d1d5db' }} formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="Valor" fill={barColor} name={metric} />
                    </BarChart>
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
