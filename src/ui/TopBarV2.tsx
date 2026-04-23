// TopBarV2 — redesigned TopBar for Saldo v0.2 "Terminal / Technical" direction.
// The legacy TopBar.tsx is kept untouched so existing pages continue to compile.
// Onboarding and new screens use this component instead.
//
// Props differ from TopBar v1: no `leading`/`subtitle`/`trailing` in the v1 sense.
// Instead we have `sub`, `onBack`, and `right`.

import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title?: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function TopBarV2({ title = 'saldo@local', sub, onBack, right }: Props) {
  return (
    <header className="shrink-0 px-[14px] py-3 flex items-center justify-between gap-2 border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-1.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Atrás"
            className="flex items-center justify-center text-muted -ml-1 p-1"
          >
            <Icon name="chev-l" size={18} />
          </button>
        )}
        <div className="flex items-center min-w-0">
          <span className="text-accent font-mono text-mono11">▌</span>
          <span className="font-mono text-mono11 text-muted tracking-wide ml-1 shrink-0">
            {title}
          </span>
          {sub && (
            <span className="font-mono text-mono10 text-dim tracking-wide ml-1 truncate">
              {' '}
              / {sub}
            </span>
          )}
        </div>
      </div>

      {/* Right section */}
      {right && <div className="flex items-center gap-1.5 shrink-0">{right}</div>}
    </header>
  );
}
