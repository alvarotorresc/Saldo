// LockPage — PIN unlock screen. Reads useLock directly.
//
// Auto-submits when PIN reaches 4-6 digits. On failure: shake dots 300ms,
// clear PIN. On lockout: disables pad and shows countdown.
// No biometrics UI in v0.2 (deferred).

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLock, LOCKOUT_THRESHOLD } from '@/stores/lock';
import { PinPad } from '@/ui/PinPad';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${s}s`;
}

export function LockPage() {
  const { unlock, failedAttempts, lockedOutUntil } = useLock();
  const [pin, setPin] = useState('');
  const [time, setTime] = useState(() => formatTime(new Date()));
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Update clock every 60s
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  // Countdown timer during lockout
  useEffect(() => {
    if (!lockedOutUntil) return;
    const update = () => {
      const remaining = lockedOutUntil - Date.now();
      setCountdown(remaining > 0 ? remaining : 0);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [lockedOutUntil]);

  const isLockedOut = lockedOutUntil !== null && Date.now() < lockedOutUntil && countdown > 0;

  const tryUnlock = useCallback(
    async (currentPin: string) => {
      if (submitting || isLockedOut) return;
      setSubmitting(true);
      try {
        const ok = await unlock(currentPin);
        if (!ok) {
          // Shake and reset
          setShaking(true);
          setTimeout(() => {
            setShaking(false);
            setPin('');
          }, 300);
        }
        // If ok, the lock store will change status to 'unlocked' — parent handles routing.
      } finally {
        setSubmitting(false);
      }
    },
    [unlock, submitting, isLockedOut],
  );

  // Auto-submit guard: use a ref to track the "submitted" pin so we don't
  // re-submit when pin state is cleared after failure.
  const lastSubmittedRef = useRef<string>('');

  useEffect(() => {
    if (pin.length >= 4 && pin.length <= 6 && !submitting && !isLockedOut) {
      if (pin !== lastSubmittedRef.current) {
        lastSubmittedRef.current = pin;
        tryUnlock(pin);
      }
    }
  }, [pin, submitting, isLockedOut, tryUnlock]);

  // Reset lastSubmittedRef when pin is cleared
  useEffect(() => {
    if (pin === '') lastSubmittedRef.current = '';
  }, [pin]);

  return (
    <div className="flex flex-col min-h-full bg-bg text-text items-center justify-center gap-8 px-4 pb-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-mono10 text-accent tracking-wider">▌ SALDO</span>
        <span className="font-mono text-d32 text-textDim tracking-tight" aria-label="Hora actual">
          {time}
        </span>
      </div>

      {/* Failed attempts warning */}
      {failedAttempts > 0 && failedAttempts < LOCKOUT_THRESHOLD && (
        <p className="font-mono text-mono10 text-warning tracking-wide text-center" role="alert">
          PIN incorrecto · {LOCKOUT_THRESHOLD - failedAttempts} intento(s) restante(s)
        </p>
      )}

      {/* Lockout banner */}
      {isLockedOut && (
        <div
          role="alert"
          className="border border-danger bg-dangerDim rounded-sm px-3 py-2 text-center"
        >
          <p className="font-mono text-mono10 text-danger tracking-wide">
            BLOQUEADO · REINTENTA EN {formatCountdown(countdown)}
          </p>
        </div>
      )}

      {/* PinPad */}
      <div data-shaking={shaking} className={shaking ? 'animate-[shake_300ms_ease-in-out]' : ''}>
        <PinPad
          value={pin}
          onChange={isLockedOut || submitting ? () => {} : setPin}
          maxLength={6}
          dotsAccent={!isLockedOut}
        />
      </div>
    </div>
  );
}
