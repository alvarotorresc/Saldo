import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { seedIfEmpty } from '@/db/database';
import { BottomNav, type Tab } from '@/ui/BottomNav';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { LedgerPage } from '@/pages/LedgerPage';
import { TxDetailPage } from '@/pages/TxDetailPage';
import { NewTxPage } from '@/pages/NewTxPage';
import { FilterSheet } from '@/ui/sheets/FilterSheet';
import { QuickActionsSheet } from '@/ui/sheets/QuickActionsSheet';
import { CommandPalette, type Command } from '@/ui/CommandPalette';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MorePage, type MoreSection } from '@/pages/MorePage';
import { GoalsPage } from '@/pages/GoalsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { LoansPage } from '@/pages/LoansPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { WealthPage } from '@/pages/WealthPage';
import { NetWorthPage } from '@/pages/NetWorthPage';
import { ExportPage } from '@/pages/ExportPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ForecastPage } from '@/pages/ForecastPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { RulesPage } from '@/pages/RulesPage';
import { useLock, installAutoLock } from '@/stores/lock';
import { OnboardingFlow } from '@/app/OnboardingFlow';
import { LockPage } from '@/pages/onboarding/LockPage';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
    try {
      localStorage.setItem(
        'saldo.lastError',
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          ts: Date.now(),
        }),
      );
    } catch {
      // Fail silently if localStorage is unavailable.
    }
  }

  handleReload = () => {
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-6">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Ha ocurrido un error inesperado</h2>
            <p className="text-sm text-muted mb-4 break-words">{this.state.error.message}</p>
            <button
              onClick={this.handleReload}
              className="press inline-flex items-center justify-center h-11 px-5 rounded-full bg-text text-bg font-semibold text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BootSplash() {
  return (
    <div className="h-full grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-sm border border-border bg-surface animate-pulse" />
        <span className="font-mono text-mono9 text-dim tracking-widest">$ init saldo@local…</span>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [moreSection, setMoreSection] = useState<MoreSection | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [txDetailId, setTxDetailId] = useState<number | null>(null);
  const [newTxOpen, setNewTxOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const status = useLock((s) => s.status);
  const boot = useLock((s) => s.boot);

  useEffect(() => {
    boot().catch((e) => console.error('lock boot failed', e));
  }, [boot]);

  useEffect(() => {
    if (status !== 'unlocked') return;
    seedIfEmpty()
      .catch((e) => console.error('seed failed', e))
      .finally(() => setSeeded(true));
  }, [status]);

  useEffect(() => {
    const cleanup = installAutoLock();
    return cleanup;
  }, []);

  if (status === 'booting') return <BootSplash />;

  if (status === 'welcome') {
    return (
      <div className="h-full flex flex-col bg-bg text-text">
        <div className="h-full flex flex-col w-full max-w-[480px] md:max-w-[720px] mx-auto md:border-x md:border-border">
          <ErrorBoundary>
            <OnboardingFlow onDone={() => undefined} />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="h-full flex flex-col bg-bg text-text">
        <div className="h-full flex flex-col w-full max-w-[480px] md:max-w-[720px] mx-auto md:border-x md:border-border">
          <ErrorBoundary>
            <LockPage />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  if (!seeded) return <BootSplash />;

  function openMore(section: MoreSection) {
    setMoreSection(section);
  }

  function handleTab(t: Tab) {
    setTab(t);
    if (t !== 'more') setMoreSection(null);
  }

  const commands: Command[] = [
    { id: 'new-expense', label: 'New expense', hint: '⌘E', onRun: () => setNewTxOpen(true) },
    { id: 'new-income', label: 'New income', hint: '⌘I', onRun: () => setNewTxOpen(true) },
    { id: 'new-transfer', label: 'New transfer', onRun: () => setNewTxOpen(true) },
    { id: 'import-csv', label: 'Import CSV', onRun: () => setTab('import') },
    { id: 'go-ledger', label: 'Go to ledger', hint: '⌘L', onRun: () => setTab('transactions') },
    { id: 'go-dashboard', label: 'Go to dashboard', hint: '⌘D', onRun: () => setTab('home') },
    {
      id: 'go-subs',
      label: 'Subscriptions',
      onRun: () => {
        setTab('more');
        setMoreSection('subscriptions');
      },
    },
    {
      id: 'go-goals',
      label: 'Goals',
      onRun: () => {
        setTab('more');
        setMoreSection('goals');
      },
    },
    {
      id: 'go-loans',
      label: 'Loans',
      onRun: () => {
        setTab('more');
        setMoreSection('loans');
      },
    },
    {
      id: 'go-charts',
      label: 'Charts',
      onRun: () => {
        setTab('more');
        setMoreSection('charts');
      },
    },
    {
      id: 'go-categories',
      label: 'Categories',
      onRun: () => {
        setTab('more');
        setMoreSection('categories');
      },
    },
    {
      id: 'go-budgets',
      label: 'Budgets',
      onRun: () => {
        setTab('more');
        setMoreSection('budgets');
      },
    },
    {
      id: 'go-rules',
      label: 'Rules',
      onRun: () => {
        setTab('more');
        setMoreSection('rules');
      },
    },
    {
      id: 'go-analytics',
      label: 'Analytics',
      onRun: () => {
        setTab('more');
        setMoreSection('analytics');
      },
    },
    {
      id: 'export',
      label: 'Export snapshot',
      onRun: () => {
        setTab('more');
        setMoreSection('export');
      },
    },
    { id: 'settings', label: 'Settings', onRun: () => setTab('settings') },
    { id: 'lock', label: 'Lock now', onRun: () => useLock.getState().lock() },
  ];

  return (
    <div className="h-full flex flex-col bg-bg text-text">
      <div className="h-full flex flex-col w-full max-w-[480px] md:max-w-[720px] mx-auto md:border-x md:border-border">
        <ErrorBoundary>
          <main className="flex-1 min-h-0 flex flex-col">
            {txDetailId != null ? (
              <TxDetailPage
                txId={txDetailId}
                onBack={() => setTxDetailId(null)}
                onDeleted={() => setTxDetailId(null)}
              />
            ) : newTxOpen ? (
              <NewTxPage
                onBack={() => setNewTxOpen(false)}
                onCommitted={(id) => {
                  setNewTxOpen(false);
                  setTab('transactions');
                  setTxDetailId(id);
                }}
              />
            ) : (
              <>
                {tab === 'home' && (
                  <DashboardPage
                    onGoImport={() => setTab('import')}
                    onGoTransactions={() => setTab('transactions')}
                    onGoSubscriptions={() => {
                      setTab('more');
                      setMoreSection('subscriptions');
                    }}
                    onGoCharts={() => {
                      setTab('more');
                      setMoreSection('charts');
                    }}
                  />
                )}
                {tab === 'transactions' && (
                  <LedgerPage
                    onOpenTx={(id) => setTxDetailId(id)}
                    onOpenFilter={() => setFilterOpen(true)}
                    onNewTx={() => setNewTxOpen(true)}
                  />
                )}
                {/* TransactionsPage kept for regression fallback until F9 purge */}
                {false && <TransactionsPage />}
                {tab === 'import' && <ImportPage />}
                {tab === 'more' &&
                  (moreSection == null ? (
                    <MorePage onOpen={openMore} />
                  ) : moreSection === 'goals' ? (
                    <GoalsPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'subscriptions' ? (
                    <SubscriptionsPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'loans' ? (
                    <LoansPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'charts' ? (
                    <ChartsPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'wealth' ? (
                    <NetWorthPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'categories' ? (
                    <CategoriesPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'forecast' ? (
                    <ForecastPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'budgets' ? (
                    <BudgetsPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'rules' ? (
                    <RulesPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'analytics' ? (
                    <AnalyticsPage onBack={() => setMoreSection(null)} />
                  ) : moreSection === 'export' ? (
                    <ExportPage onBack={() => setMoreSection(null)} />
                  ) : null)}
                {tab === 'settings' && <SettingsPage />}
              </>
            )}
          </main>
        </ErrorBoundary>
        <BottomNav
          value={tab}
          onChange={handleTab}
          onFabLongPress={() => setQuickOpen(true)}
          onCmdPalette={() => setCmdOpen(true)}
        />
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      <QuickActionsSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onNewExpense={() => setNewTxOpen(true)}
        onNewIncome={() => setNewTxOpen(true)}
        onNewTransfer={() => setNewTxOpen(true)}
        onImport={() => setTab('import')}
        onExport={() => {
          setTab('more');
          setMoreSection('export');
        }}
        onNewGoal={() => {
          setTab('more');
          setMoreSection('goals');
        }}
        onNewSubscription={() => {
          setTab('more');
          setMoreSection('subscriptions');
        }}
        onNewLoan={() => {
          setTab('more');
          setMoreSection('loans');
        }}
        onNewRule={() => {
          setTab('more');
          setMoreSection('rules');
        }}
      />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
    </div>
  );
}
