import React, { useState, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Transaction, TransactionType, IrCategory, ReceiptStatus } from './types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943', '#19D4FF'];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CustomPieChart = ({
  data,
  title,
}: {
  data: { name: string; value: number }[];
  title: string;
}) => (
  <div
    style={{
      width: '800px',
      height: '450px',
      backgroundColor: 'white',
      padding: '20px',
      boxSizing: 'border-box',
    }}
  >
    <h3 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '1rem' }}>{title}</h3>
    <ResponsiveContainer width="100%" height="90%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={150}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

// Helpers de texto para o Excel
const formatReceiptStatusLabel = (status?: ReceiptStatus): string => {
  switch (status) {
    case ReceiptStatus.HAS_BUT_NOT_ATTACHED:
      return 'Tenho comprovante';
    case ReceiptStatus.ATTACHED:
      return 'Comprovante anexado';
    case ReceiptStatus.LOST:
      return 'Tinha, mas perdi';
    case ReceiptStatus.NOT_REQUIRED:
      return 'Não exigido';
    case ReceiptStatus.NONE:
    default:
      return 'Não informado';
  }
};

const formatIrCategoryLabel = (cat?: IrCategory): string => {
  switch (cat) {
    case IrCategory.SAUDE:
      return 'Saúde';
    case IrCategory.EDUCACAO:
      return 'Educação';
    case IrCategory.LIVRO_CAIXA:
      return 'Livro-caixa / atividade';
    case IrCategory.CARNE_LEAO:
      return 'Carnê-leão';
    case IrCategory.BENS_DIREITOS:
      return 'Bens e direitos';
    case IrCategory.DIVIDAS_ONUS:
      return 'Dívidas e ônus';
    case IrCategory.GANHO_CAPITAL:
      return 'Ganho de capital';
    case IrCategory.ATIVIDADE_RURAL:
      return 'Atividade Rural';
    case IrCategory.OUTROS:
      return 'Outros';
    case IrCategory.NAO_DEDUTIVEL:
    default:
      return 'Não dedutível / Geral';
  }
};

const hasValidReceipt = (t: Transaction): boolean => {
  return (
    t.receiptStatus === ReceiptStatus.HAS_BUT_NOT_ATTACHED ||
    t.receiptStatus === ReceiptStatus.ATTACHED
  );
};

const isIrRelevant = (t: Transaction): boolean => {
  return t.irCategory !== undefined && t.irCategory !== IrCategory.NAO_DEDUTIVEL;
};

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, transactions }) => {
  const [chartOptions, setChartOptions] = useState({
    includeExpenses: true,
    includeIncome: true,
  });

  const [irOptions, setIrOptions] = useState({
    onlyWithReceipt: true,
    excludeNonDeductible: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const expenseChartRef = useRef<HTMLDivElement>(null);
  const incomeChartRef = useRef<HTMLDivElement>(null);

  // Dados dos gráficos existentes
  const { expenseData, incomeData } = useMemo(() => {
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    transactions.forEach((t) => {
      if (t.type === TransactionType.SAIDA) {
        const current = expenseMap.get(t.accountName) || 0;
        expenseMap.set(t.accountName, current + t.amount);
      } else {
        const current = incomeMap.get(t.accountName) || 0;
        incomeMap.set(t.accountName, current + t.amount);
      }
    });

    return {
      expenseData: Array.from(expenseMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      incomeData: Array.from(incomeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  // Pré-visualização do total IR com base nas opções
  const irPreviewTotal = useMemo(() => {
    const filtered = transactions.filter((t) => {
      let ok = true;

      if (irOptions.onlyWithReceipt) {
        ok = ok && hasValidReceipt(t);
      }

      if (irOptions.excludeNonDeductible) {
        ok = ok && isIrRelevant(t);
      }

      return ok;
    });

    const total = filtered.reduce((sum, t) => {
      const signedValue = t.type === TransactionType.SAIDA ? -t.amount : t.amount;
      return sum + signedValue;
    }, 0);

    return { total, count: filtered.length };
  }, [transactions, irOptions]);

  const handleExport = async () => {
    setIsLoading(true);

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LivroCaixaInteligente';
      workbook.created = new Date();

      // ================== PLANILHA GERAL DE LANÇAMENTOS ==================
      const transactionsSheet = workbook.addWorksheet('Lançamentos');
      transactionsSheet.columns = [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Conta', key: 'accountName', width: 30 },
        { header: 'Histórico', key: 'description', width: 40 },
        { header: 'Valor', key: 'amount', width: 18, style: { numFmt: '"R$"#,##0.00' } },
        { header: 'Fornecedor/Comprador', key: 'payee', width: 30 },
        { header: 'Status Comprovante', key: 'receiptStatus', width: 22 },
        { header: 'Categoria IR', key: 'irCategory', width: 25 },
        { header: 'Observações IR', key: 'irNotes', width: 40 },
      ];
      transactionsSheet.getRow(1).font = { bold: true };

      const sortedTransactions = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedTransactions.forEach((t) => {
        transactionsSheet.addRow({
          date: t.date,
          type: t.type === TransactionType.SAIDA ? 'Saída' : 'Entrada',
          accountName: t.accountName,
          description: t.description,
          amount: t.type === TransactionType.SAIDA ? -t.amount : t.amount,
          payee: t.payee,
          receiptStatus: formatReceiptStatusLabel(t.receiptStatus),
          irCategory: formatIrCategoryLabel(t.irCategory),
          irNotes: t.irNotes || '',
        });
      });

      // ================== PLANILHA ESPECÍFICA PARA IR ==================
      const irSheet = workbook.addWorksheet('IRPF');

      irSheet.columns = [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Conta', key: 'accountName', width: 30 },
        { header: 'Histórico', key: 'description', width: 40 },
        { header: 'Valor (sinal IR)', key: 'amount', width: 20, style: { numFmt: '"R$"#,##0.00' } },
        { header: 'Fornecedor/Comprador', key: 'payee', width: 30 },
        { header: 'Status Comprovante', key: 'receiptStatus', width: 22 },
        { header: 'Categoria IR', key: 'irCategory', width: 25 },
        { header: 'Observações IR', key: 'irNotes', width: 40 },
      ];
      irSheet.getRow(1).font = { bold: true };

      const irTransactions = sortedTransactions.filter((t) => {
        let ok = true;

        if (irOptions.onlyWithReceipt) {
          ok = ok && hasValidReceipt(t);
        }

        if (irOptions.excludeNonDeductible) {
          ok = ok && isIrRelevant(t);
        }

        return ok;
      });

      let irRunningTotal = 0;

      irTransactions.forEach((t) => {
        const signedValue = t.type === TransactionType.SAIDA ? -t.amount : t.amount;
        irRunningTotal += signedValue;

        irSheet.addRow({
          date: t.date,
          type: t.type === TransactionType.SAIDA ? 'Saída' : 'Entrada',
          accountName: t.accountName,
          description: t.description,
          amount: signedValue,
          payee: t.payee,
          receiptStatus: formatReceiptStatusLabel(t.receiptStatus),
          irCategory: formatIrCategoryLabel(t.irCategory),
          irNotes: t.irNotes || '',
        });
      });

      // Linha em branco + TOTAL
      if (irTransactions.length > 0) {
        irSheet.addRow({});
        const totalRow = irSheet.addRow({
          description: 'TOTAL PARA IR (apenas lançamentos filtrados)',
          amount: irRunningTotal,
        });
        totalRow.font = { bold: true };
      }

      // ================== PLANILHA RESUMO E GRÁFICOS ==================
      if (chartOptions.includeExpenses || chartOptions.includeIncome) {
        const summarySheet = workbook.addWorksheet('Resumo e Gráficos');
        let currentRow = 2;

        // Despesas
        if (chartOptions.includeExpenses && expenseChartRef.current && expenseData.length > 0) {
          summarySheet.getCell(`A${currentRow - 1}`).value = 'Despesas por Conta';
          summarySheet.getCell(`A${currentRow - 1}`).font = { bold: true, size: 14 };

          expenseData.forEach((item) => {
            summarySheet.getCell(`A${currentRow}`).value = item.name;
            summarySheet.getCell(`B${currentRow}`).value = item.value;
            summarySheet.getCell(`B${currentRow}`).numFmt = '"R$"#,##0.00';
            currentRow++;
          });

          const canvas = await html2canvas(expenseChartRef.current, { scale: 2 });
          const image = canvas.toDataURL('image/png');
          const imageId = workbook.addImage({
            base64: image,
            extension: 'png',
          });
          summarySheet.addImage(imageId, {
            tl: { col: 3.5, row: 1 },
            br: { col: 13.5, row: 22 },
          });
        }

        // Receitas
        currentRow = 25;

        if (chartOptions.includeIncome && incomeChartRef.current && incomeData.length > 0) {
          summarySheet.getCell(`A${currentRow - 1}`).value = 'Receitas por Conta';
          summarySheet.getCell(`A${currentRow - 1}`).font = { bold: true, size: 14 };

          incomeData.forEach((item) => {
            summarySheet.getCell(`A${currentRow}`).value = item.name;
            summarySheet.getCell(`B${currentRow}`).value = item.value;
            summarySheet.getCell(`B${currentRow}`).numFmt = '"R$"#,##0.00';
            currentRow++;
          });

          const canvas = await html2canvas(incomeChartRef.current, { scale: 2 });
          const image = canvas.toDataURL('image/png');
          const imageId = workbook.addImage({
            base64: image,
            extension: 'png',
          });
          summarySheet.addImage(imageId, {
            tl: { col: 3.5, row: 24 },
            br: { col: 13.5, row: 45 },
          });
        }
      }

      // ================== DOWNLOAD ==================
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Relatorio_Livro_Caixa_${new Date()
        .toLocaleDateString('pt-BR')
        .replace(/\//g, '-')}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      alert('Ocorreu um erro ao gerar o arquivo Excel.');
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Exportar para Excel
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Será gerado um arquivo .xlsx com os lançamentos filtrados, um resumo gráfico (opcional)
            e uma aba específica para facilitar sua declaração de Imposto de Renda.
          </p>

          {/* Opções dos gráficos */}
          <div className="space-y-3 mb-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
              Gráficos
            </p>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartOptions.includeExpenses}
                onChange={() =>
                  setChartOptions((prev) => ({
                    ...prev,
                    includeExpenses: !prev.includeExpenses,
                  }))
                }
                className="form-checkbox h-5 w-5 text-indigo-600 rounded"
                disabled={expenseData.length === 0}
              />
              <span className="ml-2 text-gray-700 dark:text-gray-200">
                Incluir gráfico de Despesas por Conta
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartOptions.includeIncome}
                onChange={() =>
                  setChartOptions((prev) => ({
                    ...prev,
                    includeIncome: !prev.includeIncome,
                  }))
                }
                className="form-checkbox h-5 w-5 text-indigo-600 rounded"
                disabled={incomeData.length === 0}
              />
              <span className="ml-2 text-gray-700 dark:text-gray-200">
                Incluir gráfico de Receitas por Conta
              </span>
            </label>
          </div>

          {/* Opções específicas para IR */}
          <div className="space-y-3 mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
              Opções para Relatório IRPF
            </p>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={irOptions.onlyWithReceipt}
                onChange={() =>
                  setIrOptions((prev) => ({
                    ...prev,
                    onlyWithReceipt: !prev.onlyWithReceipt,
                  }))
                }
                className="form-checkbox h-5 w-5 text-indigo-600 rounded"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-200">
                Somente lançamentos com comprovante/nota
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={irOptions.excludeNonDeductible}
                onChange={() =>
                  setIrOptions((prev) => ({
                    ...prev,
                    excludeNonDeductible: !prev.excludeNonDeductible,
                  }))
                }
                className="form-checkbox h-5 w-5 text-indigo-600 rounded"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-200">
                Ignorar categoria &quot;Não dedutível / Geral&quot;
              </span>
            </label>

            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
              <span className="font-semibold">Prévia IR:</span>{' '}
              {irPreviewTotal.count > 0 ? (
                <>
                  {irPreviewTotal.count} lançamento(s) selecionado(s) &mdash;{' '}
                  <span className="font-semibold">
                    Total: {formatCurrency(irPreviewTotal.total)}
                  </span>
                </>
              ) : (
                'Nenhum lançamento atende aos critérios atuais.'
              )}
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center"
            >
              {isLoading && (
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {isLoading ? 'Exportando...' : 'Exportar Agora'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden container para renderizar os gráficos pro html2canvas */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {chartOptions.includeExpenses && expenseData.length > 0 && (
          <div ref={expenseChartRef}>
            <CustomPieChart data={expenseData} title="Despesas por Conta" />
          </div>
        )}
        {chartOptions.includeIncome && incomeData.length > 0 && (
          <div ref={incomeChartRef}>
            <CustomPieChart data={incomeData} title="Receitas por Conta" />
          </div>
        )}
      </div>
    </>
  );
};

export default ExportModal;
