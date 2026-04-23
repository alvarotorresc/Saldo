// PinSetupPage — two-step PIN creation flow.
//
// Step 1 "enter": user sets PIN (min 4 digits). An explicit "CONTINUAR" button
//   advances to step 2. Auto-advancing on digit 4 is hostile (user may want
//   5 or 6 digits), so we require explicit confirmation.
// Step 2 "confirm": user re-enters PIN to confirm. If mismatch → back to step 1
//   with an error banner. If match → call setupPin + onComplete.

import { useState, useRef } from 'react';
import { useLock } from '@/stores/lock';
import { PinPad } from '@/ui/PinPad';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Btn } from '@/ui/primitives/Btn';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

type Step = 'enter' | 'confirm' | 'deriving';

export function PinSetupPage({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const derivingRef = useRef(false);

  function handleContinue() {
    if (pin.length < 4) return;
    setConfirmPin('');
    setError(null);
    setStep('confirm');
  }

  async function handleConfirm() {
    if (confirmPin.length < 4) return;
    if (confirmPin !== pin) {
      setError('Los PINs no coinciden');
      setPin('');
      setConfirmPin('');
      setStep('enter');
      return;
    }
    if (derivingRef.current) return;
    derivingRef.current = true;
    setStep('deriving');
    try {
      await useLock.getState().setupPin(pin);
      onComplete();
    } finally {
      derivingRef.current = false;
    }
  }

  if (step === 'deriving') {
    return (
      <div className="flex flex-col min-h-full bg-bg text-text">
        <TopBarV2 title="saldo@local" sub="ONBOARD / PIN" onBack={undefined} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <SpinnerChar />
          <p className="font-mono text-mono10 text-muted tracking-wider text-center">
            DERIVANDO CLAVE · PBKDF2 600k ITERACIONES
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-bg text-text">
      <TopBarV2
        title="saldo@local"
        sub="ONBOARD / PIN"
        onBack={step === 'enter' ? onBack : undefined}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 pb-8">
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="w-full max-w-xs border border-danger bg-dangerDim rounded-sm px-3 py-2"
          >
            <p className="font-mono text-mono10 text-danger tracking-wide">{error}</p>
          </div>
        )}

        {/* Label */}
        <p className="font-mono text-mono11 text-muted tracking-wider">
          {step === 'enter' ? 'Crea tu PIN (min 4 digitos)' : 'Confirma tu PIN'}
        </p>

        {/* PinPad */}
        {step === 'enter' ? (
          <PinPad value={pin} onChange={setPin} maxLength={6} />
        ) : (
          <PinPad value={confirmPin} onChange={setConfirmPin} maxLength={6} />
        )}

        {/* Continue / confirm button */}
        <div className="w-full max-w-[280px]">
          {step === 'enter' ? (
            <Btn variant="solid" size="lg" block disabled={pin.length < 4} onClick={handleContinue}>
              CONTINUAR →
            </Btn>
          ) : (
            <Btn
              variant="solid"
              size="lg"
              block
              disabled={confirmPin.length < 4}
              onClick={handleConfirm}
            >
              CONFIRMAR PIN →
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// Rotating indicator — cycles through ◍ ◌ ○ ◎
function SpinnerChar() {
  return (
    <span
      className="font-mono text-d24 text-accent animate-spin"
      role="status"
      aria-label="Derivando clave"
    >
      ◍
    </span>
  );
}
