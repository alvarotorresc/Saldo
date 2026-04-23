import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type BtnVariant = 'solid' | 'danger' | 'outline' | 'ghost';
export type BtnSize = 'sm' | 'md' | 'lg';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  block?: boolean;
}

const VARIANT_CLASSES: Record<BtnVariant, string> = {
  solid: 'bg-accent text-[#061208] border-accent',
  danger: 'bg-danger text-[#1a0e0e] border-danger',
  outline: 'bg-transparent text-text border-borderStrong',
  ghost: 'bg-transparent text-muted border-transparent',
};

const SIZE_CLASSES: Record<BtnSize, string> = {
  sm: 'px-2.5 py-1.5 text-mono10',
  md: 'px-3.5 py-2.5 text-mono11',
  lg: 'px-4 py-3 text-mono12',
};

export function Btn({
  children,
  variant = 'ghost',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      data-variant={variant}
      data-size={size}
      className={[
        'inline-flex items-center justify-center gap-1.5 border rounded-sm font-mono font-semibold uppercase tracking-wider',
        'transition-colors duration-fast ease-term disabled:opacity-50 disabled:cursor-not-allowed',
        'press',
        block ? 'w-full' : '',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}
