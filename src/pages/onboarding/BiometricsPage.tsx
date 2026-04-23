import { useEffect, useState } from 'react';
import { getBiometryStatus, type BiometryStatus } from '@/lib/crypto';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Badge } from '@/ui/primitives/Badge';
import { Btn } from '@/ui/primitives/Btn';

interface Props {
  onContinue: () => void;
}

export function BiometricsPage({ onContinue }: Props) {
  const [status, setStatus] = useState<BiometryStatus | null>(null);

  useEffect(() => {
    getBiometryStatus()
      .then(setStatus)
      .catch(() => {
        setStatus({ isAvailable: false, reason: 'deferred-v03' });
      });
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-bg text-text">
      <TopBarV2 title="saldo@local" sub="ONBOARD / BIOMETRIA" />

      <div className="flex-1 flex flex-col items-start justify-center gap-6 px-4 pb-8">
        <h2 className="font-mono text-mono12 text-text tracking-wider">Autenticacion biometrica</h2>

        {/* Status — only rendered once getBiometryStatus has resolved */}
        {status !== null && !status.isAvailable && (
          <div
            role="status"
            aria-label="Estado biometria"
            className="w-full border border-border bg-surface rounded-sm px-3 py-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <Badge tone="muted">NOT AVAILABLE</Badge>
            </div>
            <p className="font-mono text-mono10 text-muted tracking-wide">
              Biometria no disponible en v0.2 — se activara en v0.3
            </p>
          </div>
        )}

        <div className="flex-1" />

        <Btn variant="solid" size="lg" block onClick={onContinue}>
          CONTINUAR →
        </Btn>
      </div>
    </div>
  );
}
