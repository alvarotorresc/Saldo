import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Section({ title, right, children, className = '' }: Props) {
  return (
    <section className={`px-3.5 pt-3.5 pb-1 ${className}`}>
      <header className="flex justify-between items-baseline mb-2.5">
        <h2 className="font-mono text-mono10 text-muted uppercase tracking-widest">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}
