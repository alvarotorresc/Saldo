import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  maxHeight?: string;
}

// Module-level stack of onClose callbacks. Only the topmost Sheet reacts to Escape.
const sheetStack: Array<() => void> = [];

export function Sheet({ open, onClose, title, ariaLabel, children, maxHeight = '85vh' }: Props) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    sheetStack.push(onClose);

    // Save and move focus into the dialog for accessibility.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const toFocus = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (toFocus ?? dialogRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Only the topmost Sheet responds to Escape.
      if (sheetStack[sheetStack.length - 1] === onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
      const idx = sheetStack.indexOf(onClose);
      if (idx >= 0) sheetStack.splice(idx, 1);
      // Restore previous focus.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const labelledBy = title ? headingId : undefined;
  const label = !title ? ariaLabel : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className="relative w-full bg-surface border-t border-border rounded-t-3xl animate-[slideUp_.2s_ease] outline-none"
        style={{ maxHeight, paddingBottom: 'var(--sab)' }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-borderStrong" />
        </div>
        {title && (
          <div className="px-5 pt-2 pb-3 border-b border-border">
            <h2 id={headingId} className="text-base font-semibold">
              {title}
            </h2>
          </div>
        )}
        <div className="scroll-area p-5" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(12%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
