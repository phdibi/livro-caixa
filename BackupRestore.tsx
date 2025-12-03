import React, { useState, useRef } from 'react';
import { Transaction, Account, RecurringTransaction } from './types';

interface BackupRestoreProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: Account[];
  recurringTransactions: RecurringTransaction[];
  onRestore: (data: {
    transactions: Transaction[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
  }) => Promise<void>;
}

interface BackupData {
  version: string;
  exportDate: string;
  transactions: Transaction[];
  accounts: Account[];
  recurringTransactions: RecurringTransaction[];
}

const BACKUP_VERSION = '1.0';

const BackupRestore: React.FC<BackupRestoreProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  recurringTransactions,
  onRestore,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    const backupData: BackupData = {
      version: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
      transactions,
      accounts,
      recurringTransactions,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `livro_caixa_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestorePreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as BackupData;

        // Validar estrutura básica
        if (!data.version || !data.transactions || !data.accounts) {
          throw new Error('Arquivo de backup inválido ou corrompido.');
        }

        setRestorePreview(data);
      } catch (err: any) {
        setRestoreError(err.message || 'Erro ao ler arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;

    const confirmMsg = `ATENÇÃO: Isso irá SUBSTITUIR todos os seus dados atuais por:
    
- ${restorePreview.transactions.length} transações
- ${restorePreview.accounts.length} contas
- ${restorePreview.recurringTransactions?.length || 0} contas fixas

Backup de: ${new Date(restorePreview.exportDate).toLocaleString('pt-BR')}

Tem certeza que deseja continuar?`;

    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    try {
      await onRestore({
        transactions: restorePreview.transactions,
        accounts: restorePreview.accounts,
        recurringTransactions: restorePreview.recurringTransactions || [],
      });

      alert('Dados restaurados com sucesso!');
      onClose();
    } catch (err: any) {
      setRestoreError(err.message || 'Erro ao restaurar dados.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelPreview = () => {
    setRestorePreview(null);
    setRestoreError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Backup e Restauração
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Seção de Backup */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Exportar Backup
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Salve uma cópia de todos os seus dados em um arquivo JSON.
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            <div>• {transactions.length} transações</div>
            <div>• {accounts.length} contas</div>
            <div>• {recurringTransactions.length} contas fixas</div>
          </div>
          <button
            onClick={handleExportBackup}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Baixar Backup
          </button>
        </div>

        {/* Seção de Restauração */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Restaurar Backup
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            ⚠️ Isso substituirá TODOS os dados atuais pelos do backup.
          </p>

          {restoreError && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded">
              {restoreError}
            </div>
          )}

          {!restorePreview ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-indigo-50 file:text-indigo-700
                  dark:file:bg-indigo-900 dark:file:text-indigo-200
                  hover:file:bg-indigo-100
                  cursor-pointer"
              />
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-md">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prévia do Backup:
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                <div>
                  Data: {new Date(restorePreview.exportDate).toLocaleString('pt-BR')}
                </div>
                <div>• {restorePreview.transactions.length} transações</div>
                <div>• {restorePreview.accounts.length} contas</div>
                <div>
                  • {restorePreview.recurringTransactions?.length || 0} contas
                  fixas
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCancelPreview}
                  className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isRestoring ? 'Restaurando...' : 'Confirmar Restauração'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;
