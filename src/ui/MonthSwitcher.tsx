import { Icon } from './Icon';
import { currentMonth, formatMonth, shiftMonth } from '@/lib/format';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSwitcher({ month, onChange }: Props) {
  const now = currentMonth();
  const nextDisabled = month >= now;
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="press w-9 h-9 rounded-full bg-elevated border border-border grid place-items-center text-muted"
        aria-label="Mes anterior"
      >
        <Icon name="chevron-left" />
      </button>
      <div className="text-sm font-medium tracking-tight">{formatMonth(month)}</div>
      <button
        onClick={() => {
          if (nextDisabled) return;
          onChange(shiftMonth(month, 1));
        }}
        aria-disabled={nextDisabled}
        disabled={nextDisabled}
        className={`press w-9 h-9 rounded-full bg-elevated border border-border grid place-items-center text-muted ${
          nextDisabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
        aria-label="Mes siguiente"
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
