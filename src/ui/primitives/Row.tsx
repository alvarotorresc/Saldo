import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

interface Props {
  left: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  icon?: IconName;
  iconClassName?: string;
  chevron?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  className?: string;
}

export function Row({
  left,
  right,
  sub,
  meta,
  icon,
  iconClassName = 'text-muted',
  chevron = false,
  onClick,
  className = '',
}: Props) {
  const interactive = typeof onClick === 'function';
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e as unknown as MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      className={[
        'flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border',
        interactive ? 'cursor-pointer press' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <div
          className={`w-[26px] h-[26px] border border-borderStrong rounded-xs grid place-items-center shrink-0 ${iconClassName}`}
        >
          <Icon name={icon} size={13} stroke={1.6} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-mono12 text-text tracking-wide truncate">{left}</div>
        {sub !== undefined && (
          <div className="font-mono text-mono10 text-dim mt-0.5 tracking-wide truncate">{sub}</div>
        )}
      </div>
      {right !== undefined && (
        <div className="text-right shrink-0">
          <div className="font-mono text-mono12 text-text tabular">{right}</div>
          {meta !== undefined && <div className="font-mono text-mono9 text-dim mt-0.5">{meta}</div>}
        </div>
      )}
      {chevron && <Icon name="chev-r" size={12} stroke={1.5} className="text-dim shrink-0" />}
    </div>
  );
}
