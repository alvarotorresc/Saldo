import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon: ReactNode;
  /** Optional explicit aria-label. If not provided, falls back to `label` or "Acción". */
  'aria-label'?: string;
}

export function FAB({ label, icon, className = '', ...rest }: Props) {
  const ariaLabel = rest['aria-label'] ?? label ?? 'Acción';
  return (
    <button
      {...rest}
      aria-label={ariaLabel}
      className={`press fixed z-40 inline-flex items-center gap-2 h-12 ${
        label ? 'px-4' : 'w-12 px-0'
      } rounded-xs border border-accent bg-surface text-accent font-mono tracking-widest ${className}`}
      style={{
        bottom: `calc(var(--sab) + 72px)`,
        right: `max(1rem, calc((100vw - 720px) / 2 + 1rem))`,
      }}
    >
      {icon}
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}
