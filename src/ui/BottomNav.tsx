import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'transactions' | 'import' | 'more' | 'settings';

interface Props {
  value: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'transactions', label: 'Movimientos', icon: 'list' },
  { key: 'import', label: 'Importar', icon: 'import' },
  { key: 'more', label: 'Más', icon: 'grid' },
  { key: 'settings', label: 'Ajustes', icon: 'settings' },
];

export function BottomNav({ value, onChange }: Props) {
  return (
    <nav
      className="shrink-0 border-t border-border bg-bg/90 backdrop-blur"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`press flex flex-col items-center justify-center gap-0.5 py-2.5 ${
                active ? 'text-text' : 'text-dim'
              }`}
            >
              <Icon name={t.icon} size={22} />
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
