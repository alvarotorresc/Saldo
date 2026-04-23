import { formatMoney } from '@/lib/format';

interface Props {
  value: number;
  signed?: boolean;
  kind?: 'expense' | 'income' | 'neutral';
  className?: string;
  currency?: string;
}

export function Money({ value, signed, kind = 'neutral', className = '', currency }: Props) {
  const color =
    kind === 'expense' ? 'text-danger' : kind === 'income' ? 'text-accent' : 'text-text';
  const prefix = signed ? (kind === 'expense' ? '-' : kind === 'income' ? '+' : '') : '';
  const displayValue = signed && kind !== 'neutral' ? Math.abs(value) : value;
  return (
    <span className={`tabular ${color} ${className}`}>
      {prefix}
      {formatMoney(displayValue, currency)}
    </span>
  );
}
