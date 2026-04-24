/**
 * BiometricsPage — F13 real biometric toggle. Reads getBiometryStatus() from
 * the Capacitor plugin. If available, offers to enable now (stores the PIN
 * in the keystore); otherwise shows a read-only state explaining why.
 */
import { useEffect, useState } from 'react';
import { enableBiometry, getBiometryStatus, type BiometryStatus } from '@/lib/crypto';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Badge } from '@/ui/primitives/Badge';
import { Btn } from '@/ui/primitives/Btn';
import { PinPad } from '@/ui/PinPad';

interface Props {
  onContinue: () => void;
  pin?: string; // the PIN the user just set, needed to enable biometric unlock
}

export function BiometricsPage({ onContinue, pin }: Props) {
  const [status, setStatus] = useState<BiometryStatus | null>(null);
  const [askPin, setAskPin] = useState(false);
  const [localPin, setLocalPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBiometryStatus()
      .then(setStatus)
      .catch(() => {
        setStatus({ isAvailable: false, hasSavedPin: false, reason: 'not-supported' });
      });
  }, []);

  async function enable(pinToUse: string) {
    setSaving(true);
    setError(null);
    const ok = await enableBiometry(pinToUse);
    setSaving(false);
    if (!ok) {
      setError('No se pudo activar la biometría. Intenta de nuevo o continúa sin ella.');
      return;
    }
    setStatus((s) => (s ? { ...s, hasSavedPin: true } : s));
    onContinue();
  }

  function handleEnable() {
    if (pin) {
      void enable(pin);
      return;
    }
    setAskPin(true);
  }

  const reasonLabel: Record<NonNullable<BiometryStatus['reason']>, string> = {
    'not-supported': 'Dispositivo sin soporte biométrico',
    'not-enrolled': 'No hay huella o rostro registrados en el sistema',
    'not-enabled': 'Disponible, aún no activada',
    error: 'Error al consultar el sistema',
  };

  return (
    <div className="flex flex-col min-h-full bg-bg text-text">
      <TopBarV2 title="saldo@local" sub="ONBOARD / BIOMETRIA" />

      <div className="flex-1 flex flex-col items-start justify-center gap-6 px-4 pb-8">
        <h2 className="font-mono text-mono12 text-text tracking-wider">Autenticación biométrica</h2>

        {status === null && (
          <p className="font-mono text-mono10 text-dim">Comprobando disponibilidad…</p>
        )}

        {status && (
          <div
            role="status"
            aria-label="Estado biometría"
            className="w-full border border-border bg-surface rounded-xs px-3 py-3 flex flex-col gap-2"
            data-testid="biometry-status"
          >
            <div className="flex items-center gap-2">
              {status.isAvailable ? (
                <Badge tone="ok">AVAILABLE</Badge>
              ) : (
                <Badge tone="muted">NOT AVAILABLE</Badge>
              )}
              {status.kind && (
                <span className="font-mono text-mono9 text-dim uppercase tracking-widest">
                  {status.kind.replace('-', ' ')}
                </span>
              )}
            </div>
            <p className="font-mono text-mono10 text-muted tracking-wide">
              {status.reason ? reasonLabel[status.reason] : 'Listo para usar.'}
            </p>
          </div>
        )}

        {status?.isAvailable && !status.hasSavedPin && !askPin && (
          <Btn
            variant="solid"
            block
            onClick={handleEnable}
            disabled={saving}
            data-testid="biometry-enable"
          >
            ACTIVAR_BIOMETRIA
          </Btn>
        )}

        {askPin && (
          <div className="w-full space-y-3">
            <p className="font-mono text-mono10 text-dim text-center">
              Introduce tu PIN para guardarlo en el keystore del sistema
            </p>
            <PinPad value={localPin} onChange={setLocalPin} />
            <Btn
              variant="solid"
              block
              disabled={localPin.length < 4 || saving}
              onClick={() => void enable(localPin)}
            >
              {saving ? 'GUARDANDO…' : 'CONFIRMAR'}
            </Btn>
          </div>
        )}

        {error && (
          <p role="alert" className="font-mono text-mono10 text-danger">
            {error}
          </p>
        )}

        <div className="flex-1" />

        <Btn variant="ghost" size="lg" block onClick={onContinue}>
          {status?.hasSavedPin ? 'CONTINUAR →' : 'SALTAR BIOMETRIA →'}
        </Btn>
      </div>
    </div>
  );
}
