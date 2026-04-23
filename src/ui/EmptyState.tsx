import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <div className="w-12 h-12 rounded-2xl border border-border bg-elevated mb-4 flex items-center justify-center text-muted">
        {icon ?? <Icon name="folder" size={22} />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
