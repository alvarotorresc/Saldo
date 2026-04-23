import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { seedIfEmpty } from '@/db/database';
import { BottomNav, type Tab } from '@/ui/BottomNav';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MorePage, type MoreSection } from '@/pages/MorePage';
import { GoalsPage } from '@/pages/GoalsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { LoansPage } from '@/pages/LoansPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { WealthPage } from '@/pages/WealthPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ForecastPage } from '@/pages/ForecastPage';
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

  return (
    <div className="h-full flex flex-col bg-bg text-text">
      <div className="h-full flex flex-col w-full max-w-[480px] md:max-w-[720px] mx-auto md:border-x md:border-border">
        <ErrorBoundary>
          <main className="flex-1 min-h-0 flex flex-col">
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
            {tab === 'transactions' && <TransactionsPage />}
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
                <WealthPage onBack={() => setMoreSection(null)} />
              ) : moreSection === 'categories' ? (
                <CategoriesPage onBack={() => setMoreSection(null)} />
              ) : moreSection === 'forecast' ? (
                <ForecastPage onBack={() => setMoreSection(null)} />
              ) : null)}
            {tab === 'settings' && <SettingsPage />}
          </main>
        </ErrorBoundary>
        <BottomNav value={tab} onChange={handleTab} />
      </div>
    </div>
  );
}
