import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  leading?: ReactNode;
  trailing?: ReactNode;
  full?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text text-bg hover:bg-white',
  secondary: 'bg-elevated text-text border border-border',
  ghost: 'bg-transparent text-text hover:bg-elevated',
  danger: 'bg-dangerDim text-danger border border-danger/30',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  full,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`press inline-flex items-center justify-center gap-2 font-medium disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
