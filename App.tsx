// === App.tsx OTIMIZADO ===
import React, { lazy, Suspense } from 'react';
import { ToastProvider } from './Toast';
import { useAppLogic } from './hooks/useAppLogic';
import ErrorBoundary from './components/ErrorBoundary';

// Core Components (always loaded)
import Login from './Login';
import TransactionFilter from './TransactionFilter';
import { Header } from './components/Layout/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { TransactionList } from './components/Transactions/TransactionList';
import { LoadingSpinner } from './components/UI/LoadingSpinner';

// Lazy loaded components (loaded on demand)
const CashFlowReport = lazy(() => import('./CashFlowReport'));
const IrpfView = lazy(() => import('./components/Reports/IrpfView').then(m => ({ default: m.IrpfView })));
const EntryForm = lazy(() => import('./EntryForm'));
const RecurringTransactionsModal = lazy(() => import('./RecurringTransactionsModal'));
const ExportModal = lazy(() => import('./ExportModal'));
const BackupRestore = lazy(() => import('./BackupRestore'));

const AppContent: React.FC = () => {
  const {
    user,
    authLoading,
    dataLoading,
    isSyncing,
    filteredTransactions,
    transactions,
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
    handleDeleteTransactions,
    handleSaveTransaction,
    handleGenerateRecurring,
    handleSaveRecurring,
    handleDeleteRecurring,
    handleRestore,
    pagination,
    handleLoadMore,
    isLoadingMore,
    isBackgroundSyncing,
    chartTransactions,
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
        isBackgroundSyncing={isBackgroundSyncing}
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
                filteredTransactions={chartTransactions}
                accounts={accounts}
              />
            )}

            {/* Fluxo de Caixa */}
            {activeView === 'cashflow' && (
              <div className="mt-4">
                <Suspense fallback={<LoadingSpinner />}>
                  <CashFlowReport transactions={chartTransactions} />
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
                onDelete={handleDeleteTransactions}
                invoiceGroups={invoiceGroups}
                onLoadMore={handleLoadMore}
                isLoadingMore={isLoadingMore}
              />
            )}

            {/* IRPF */}
            {activeView === 'irpf' && (
              <Suspense fallback={<LoadingSpinner />}>
                <IrpfView irpfResumo={irpfResumo} />
              </Suspense>
            )}
          </>
        )}
      </main>

      {/* Modais - Lazy loaded com Suspense */}
      <Suspense fallback={null}>
        {isFormOpen && (
          <EntryForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveTransaction}
            transactionToEdit={transactionToEdit}
            accounts={accounts}
            transactions={transactions}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isRecurringModalOpen && (
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
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isExportModalOpen && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            transactions={filteredTransactions}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isBackupModalOpen && (
          <BackupRestore
            isOpen={isBackupModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            transactions={transactions}
            accounts={accounts}
            recurringTransactions={recurringTransactions}
            onRestore={handleRestore}
          />
        )}
      </Suspense>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </ErrorBoundary>
);

export default App;