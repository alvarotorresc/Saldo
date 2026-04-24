import { useRef } from 'react';
import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'transactions' | 'import' | 'more' | 'settings';

interface Props {
  value: Tab;
  onChange: (tab: Tab) => void;
  onFabLongPress?: () => void;
  onCmdPalette?: () => void;
}

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'transactions', label: 'Movimientos', icon: 'list' },
  { key: 'import', label: 'Importar', icon: 'import' },
  { key: 'more', label: 'Más', icon: 'grid' },
  { key: 'settings', label: 'Ajustes', icon: 'settings' },
];

export function BottomNav({ value, onChange, onFabLongPress, onCmdPalette }: Props) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <nav
      className="shrink-0 border-t border-border bg-bg/90 backdrop-blur relative"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      {onCmdPalette && (
        <button
          type="button"
          onClick={onCmdPalette}
          aria-label="Paleta de comandos"
          className="absolute right-2 -top-3 z-10 w-8 h-8 rounded-xs border border-border bg-surface flex items-center justify-center press"
          data-testid="cmd-trigger"
        >
          <Icon name="search" size={14} />
        </button>
      )}
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = value === t.key;
          const isFab = t.key === 'transactions' && onFabLongPress;
          return (
            <button
              key={t.key}
              onPointerDown={() => {
                if (isFab) {
                  pressTimer.current = setTimeout(() => {
                    pressTimer.current = null;
                    onFabLongPress?.();
                  }, 500);
                }
              }}
              onPointerUp={() => {
                if (pressTimer.current) {
                  clearTimeout(pressTimer.current);
                  pressTimer.current = null;
                  onChange(t.key);
                }
              }}
              onPointerCancel={() => {
                if (pressTimer.current) {
                  clearTimeout(pressTimer.current);
                  pressTimer.current = null;
                }
              }}
              onClick={() => {
                if (!isFab) onChange(t.key);
              }}
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
