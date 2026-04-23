// BottomNavV2 — redesigned 4-tab nav for Saldo v0.2 "Terminal / Technical" direction.
// The legacy BottomNav.tsx is kept untouched (App.tsx imports it with the old Tab type).
// Onboarding/F2 rewrite of App.tsx will migrate to this component.
//
// Tab layout: HOME · LEDGER · NEW (FAB) · MORE

import { Icon } from './Icon';

export type Tab = 'home' | 'ledger' | 'new' | 'more';

// Legacy tab union preserved so a future adapter can accept either.
export type LegacyTab = 'home' | 'transactions' | 'import' | 'more' | 'settings';

interface Props {
  value: Tab;
  onChange: (tab: Tab) => void;
}

interface RegularTab {
  key: Tab;
  label: string;
  icon: 'home' | 'list' | 'grid';
}

const LEFT_TABS: RegularTab[] = [
  { key: 'home', label: 'HOME', icon: 'home' },
  { key: 'ledger', label: 'LEDGER', icon: 'list' },
];

const RIGHT_TABS: RegularTab[] = [{ key: 'more', label: 'MORE', icon: 'grid' }];

export function BottomNavV2({ value, onChange }: Props) {
  return (
    <nav className="shrink-0 border-t border-border bg-bg" style={{ paddingBottom: 'var(--sab)' }}>
      {/* 5-column grid: home | ledger | fab | more | (empty right padding mirror) */}
      <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr]">
        {/* Left tabs */}
        {LEFT_TABS.map((t) => (
          <TabButton
            key={t.key}
            tabKey={t.key}
            label={t.label}
            icon={t.icon}
            active={value === t.key}
            onClick={() => onChange(t.key)}
          />
        ))}

        {/* Central FAB — NEW */}
        <button
          type="button"
          onClick={() => onChange('new')}
          data-active={value === 'new'}
          aria-label="Nueva transacción"
          aria-pressed={value === 'new'}
          className={[
            'flex items-center justify-center my-[10px] mx-[14px]',
            'w-[38px] h-[38px]',
            'bg-accent text-[#061208] rounded-sm',
            'shadow-[0_0_0_3px_#08090a,0_0_0_4px_rgba(143,192,136,0.20)]',
            'transition-colors duration-fast',
          ].join(' ')}
        >
          <Icon name="plus" size={18} stroke={2} />
        </button>

        {/* Right tabs */}
        {RIGHT_TABS.map((t) => (
          <TabButton
            key={t.key}
            tabKey={t.key}
            label={t.label}
            icon={t.icon}
            active={value === t.key}
            onClick={() => onChange(t.key)}
          />
        ))}

        {/* Mirror column for symmetry */}
        <div />
      </div>
    </nav>
  );
}

interface TabButtonProps {
  tabKey: Tab;
  label: string;
  icon: 'home' | 'list' | 'grid';
  active: boolean;
  onClick: () => void;
}

function TabButton({ tabKey, label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      data-tab={tabKey}
      aria-pressed={active}
      aria-label={label}
      className={[
        'flex flex-col items-center justify-center gap-[3px] py-2.5',
        'transition-colors duration-fast',
        active ? 'border-t border-accent text-text' : 'border-t border-transparent text-dim',
      ].join(' ')}
    >
      <Icon name={icon} size={18} />
      <span className="font-mono text-[8.5px] leading-[11px] uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
