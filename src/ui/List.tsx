import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface RowProps {
  icon?: IconName;
  color?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
}

export function ListRow({ icon, color, title, subtitle, right, onClick }: RowProps) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && (
        <div
          className="w-9 h-9 rounded-full grid place-items-center shrink-0"
          style={{
            background: (color ?? '#2A2A30') + '22',
            color: color ?? '#8A8A93',
          }}
        >
          <Icon name={icon} size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-muted truncate mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="press w-full text-left">
        {content}
      </button>
    );
  }
  return content;
}
