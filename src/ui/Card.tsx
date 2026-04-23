import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, padded = true, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-surface border border-border rounded-2xl shadow-card ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
