// === App.tsx OTIMIZADO ===
import React, { lazy, Suspense } from 'react';
import { ToastProvider } from './Toast';
import { useAppLogic } from './hooks/useAppLogic';

// Components
import Login from './Login';
import TransactionFilter from './TransactionFilter';
import EntryForm from './EntryForm';
import RecurringTransactionsModal from './RecurringTransactionsModal';
import ExportModal from './ExportModal';
import BackupRestore from './BackupRestore';
import { Header } from './components/Layout/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { TransactionList } from './components/Transactions/TransactionList';
import { IrpfView } from './components/Reports/IrpfView';
import { LoadingSpinner } from './components/UI/LoadingSpinner';

// Lazy load
const CashFlowReport = lazy(() => import('./CashFlowReport'));

const AppContent: React.FC = () => {
  const {
    user,
    authLoading,
    dataLoading,
    isSyncing,
    filteredTransactions,
    accounts,
    recurringTransactions,
    setRecurringTransactions,
    irpfResumo,
    totalEntradas,
    totalSaidas,
    margem,
    invoiceGroups,
    filters,
    setFilters,
    clearFilters,
    isFormOpen,
    setIsFormOpen,
    transactionToEdit,
    activeView,
    setActiveView,
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    sortOrder,
    setSortOrder,
    handleSignOut,
    handleForceSync,
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handleSaveTransaction,
    handleGenerateRecurring,
    handleSaveRecurring,
    handleDeleteRecurring,
    handleRestore,
    pagination,
  } = useAppLogic();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">
        Carregando...
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        onSignOut={handleSignOut}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onForceSync={handleForceSync}
        isSyncing={isSyncing}
        onExport={() => setIsExportModalOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenRecurring={() => setIsRecurringModalOpen(true)}
        onAddTransaction={handleAddTransaction}
      />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {dataLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <TransactionFilter
              filters={filters}
              onFilterChange={setFilters}
              accounts={accounts}
              onClear={clearFilters}
            />

            {/* Dashboard */}
            {activeView === 'dashboard' && (
              <DashboardView
                totalEntradas={totalEntradas}
                totalSaidas={totalSaidas}
                margem={margem}
                filteredTransactions={filteredTransactions}
                accounts={accounts}
              />
            )}

            {/* Fluxo de Caixa */}
            {activeView === 'cashflow' && (
              <div className="mt-4">
                <Suspense fallback={<LoadingSpinner />}>
                  <CashFlowReport transactions={filteredTransactions} />
                </Suspense>
              </div>
            )}

            {/* Lista */}
            {activeView === 'list' && (
              <TransactionList
                transactions={pagination.paginatedItems}
                allTransactionsCount={filteredTransactions.length}
                pagination={pagination}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                invoiceGroups={invoiceGroups}
              />
            )}

            {/* IRPF */}
            {activeView === 'irpf' && <IrpfView irpfResumo={irpfResumo} />}
          </>
        )}
      </main>

      {/* Modais */}
      <EntryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveTransaction}
        transactionToEdit={transactionToEdit}
        accounts={accounts}
        transactions={transactions}
      // App passed 'transactions' which was the full list.
      // I should verify entry form prop name. 'transactions'.
      // useAppLogic returns 'transactions'. Let's use that.
      // But in the hook I returned 'transactions' (state).
      // Let's pass 'transactions'.
      />

      {/* Wait, EntryForm prop passed in App.tsx was 'transactions' (state). */}

      <RecurringTransactionsModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        accounts={accounts}
        recurringTransactions={recurringTransactions}
        setRecurringTransactions={setRecurringTransactions}
        onGenerate={handleGenerateRecurring}
        onSaveItem={handleSaveRecurring}
        onDeleteItem={handleDeleteRecurring}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transactions={filteredTransactions}
      />

      <BackupRestore
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        transactions={transactions} // Full list
        accounts={accounts}
        recurringTransactions={recurringTransactions}
        onRestore={handleRestore}
      />
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;