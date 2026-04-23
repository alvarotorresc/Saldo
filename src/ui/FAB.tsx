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
      className={`press fixed z-40 inline-flex items-center gap-2 h-14 ${
        label ? 'px-5' : 'w-14 px-0'
      } rounded-full bg-text text-bg font-semibold shadow-xl shadow-black/50 ${className}`}
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
