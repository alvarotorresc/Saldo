/**
 * SettingsPage — F10 rewrite (ScrSettings). Identity header + secciones
 * SEGURIDAD / DATOS / APARIENCIA / PRIVACIDAD / INFO. Implementa PIN change,
 * auto-lock stepper, wipe completo, toggle de modo Dashboard y toggle de
 * dashboardMode default.
 */
import { useState } from 'react';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon, type IconName } from '@/ui/Icon';
import { Badge, Btn } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { PinPad } from '@/ui/PinPad';
import { useLock, DEFAULT_AUTO_LOCK_MS } from '@/stores/lock';
import { useMeta } from '@/stores/meta';

const VERSION = '0.2.0';

const AUTO_LOCK_OPTIONS: { label: string; ms: number }[] = [
  { label: '15s', ms: 15_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
  { label: '15m', ms: 900_000 },
];

export function SettingsPage() {
  const autoLockMs = useLock((s) => s.autoLockMs);
  const wipeVault = useLock((s) => s.wipeVault);
  const setAutoLockMs = useLock((s) => s.setAutoLockMs);
  const dashboardMode = useMeta((s) => s.dashboardMode);
  const setDashboardMode = useMeta((s) => s.setDashboardMode);

  const [pinOpen, setPinOpen] = useState(false);
  const [autoLockOpen, setAutoLockOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  async function doWipe() {
    if (
      !window.confirm(
        '¿Borrar todos los datos? Transacciones, reglas, goals, subs y préstamos desaparecen. El vault también. Esta acción no se puede deshacer.',
      )
    ) {
      return;
    }
    if (!window.confirm('Último aviso. ¿Seguro?')) return;
    await wipeVault();
  }

  function autoLockLabel(): string {
    const match = AUTO_LOCK_OPTIONS.find((o) => o.ms === autoLockMs);
    return match?.label ?? `${Math.round(autoLockMs / 1000)}s`;
  }

  return (
    <>
      <TopBarV2 title="saldo@local" sub="SETTINGS" />
      <div className="scroll-area flex-1 pb-6" data-testid="settings-page">
        {/* Identity */}
        <section className="px-3.5 py-3.5 border-b border-border flex items-center gap-3">
          <span className="w-10 h-10 border border-accent bg-surface rounded-xs grid place-items-center font-mono text-[13px] text-accent">
            ●
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-mono12 text-text">usuario@local</div>
            <div className="font-mono text-mono9 text-dim mt-0.5 truncate">
              device: {typeof navigator !== 'undefined' ? navigator.platform : 'web'} · saldo v
              {VERSION}
            </div>
          </div>
          <Badge tone="ok">
            <Icon name="lock" size={8} stroke={2} />
            OFFLINE
          </Badge>
        </section>

        <SectionHeader label="SEGURIDAD" />
        <Row
          icon="lock"
          label="Cambiar PIN"
          value="••••••"
          onClick={() => setPinOpen(true)}
          testId="set-change-pin"
        />
        <Row
          icon="shield"
          label="Auto-lock"
          value={autoLockLabel()}
          onClick={() => setAutoLockOpen(true)}
          testId="set-auto-lock"
        />
        <Row
          icon="finger"
          label="Biometría"
          value="ver F13"
          subtle="disponible al subir a Capacitor 8"
        />

        <SectionHeader label="DATOS" />
        <Row
          icon="trash"
          label="Borrar todos los datos"
          value="Peligroso"
          danger
          onClick={() => void doWipe()}
          testId="set-wipe"
        />

        <SectionHeader label="APARIENCIA" />
        <Row
          icon="chart"
          label="Modo Dashboard"
          value={dashboardMode.toUpperCase()}
          onClick={() => setDashboardOpen(true)}
          testId="set-dashboard-mode"
        />
        <Row icon="eye" label="Tema" value="Dark · Terminal" />

        <SectionHeader label="PRIVACIDAD" />
        <Row
          icon="wifi-off"
          label="Telemetría anónima"
          value="OFF"
          subtle="local-first por diseño"
        />
        <Row
          icon="cpu"
          label="Sincronización nube"
          value="OFF"
          subtle="sin cuentas, sin servidor"
        />

        <SectionHeader label="INFO" />
        <Row icon="info" label="Versión" value={`v${VERSION}`} />
        <Row
          icon="link"
          label="Código fuente"
          value="github →"
          onClick={() => window.open('https://github.com/alvarotorresc/Saldo', '_blank')}
        />
        <Row icon="shield" label="Local-first · no tracking · open source" />

        <p className="mt-4 text-center font-mono text-mono9 text-dim leading-relaxed px-3.5">
          SALDO · v{VERSION}
          <br />
          <span className="text-muted">local-first</span> ·{' '}
          <span className="text-accent">no tracking</span> ·{' '}
          <span className="text-info">open source</span>
        </p>
      </div>

      <ChangePinSheet open={pinOpen} onClose={() => setPinOpen(false)} />

      <Sheet open={autoLockOpen} onClose={() => setAutoLockOpen(false)} title="Auto-lock timeout">
        <ul className="space-y-1">
          {AUTO_LOCK_OPTIONS.map((o) => (
            <li key={o.ms}>
              <button
                type="button"
                onClick={() => {
                  setAutoLockMs(o.ms);
                  setAutoLockOpen(false);
                }}
                className="w-full flex items-center justify-between px-2 py-3 border border-border rounded-xs font-mono text-mono11 text-text press"
              >
                <span>{o.label}</span>
                {autoLockMs === o.ms && <Icon name="check" size={14} className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>
        <Btn
          variant="ghost"
          block
          className="mt-3"
          onClick={() => {
            setAutoLockMs(DEFAULT_AUTO_LOCK_MS);
            setAutoLockOpen(false);
          }}
        >
          RESET
        </Btn>
      </Sheet>

      <Sheet open={dashboardOpen} onClose={() => setDashboardOpen(false)} title="Modo Dashboard">
        <div className="space-y-2">
          {(['sobrio', 'charts'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                void setDashboardMode(m);
                setDashboardOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-3 border border-border rounded-xs font-mono text-mono11 text-text press"
            >
              <span>{m.toUpperCase()}</span>
              {dashboardMode === m && <Icon name="check" size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3.5 py-2.5 bg-surface border-y border-border font-mono text-mono9 text-dim tracking-widest uppercase">
      {label}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  subtle,
  onClick,
  danger = false,
  testId,
}: {
  icon: IconName;
  label: string;
  value?: string;
  subtle?: string;
  onClick?: () => void;
  danger?: boolean;
  testId?: string;
}) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      className={[
        'w-full flex items-center gap-3 px-3.5 py-3 border-b border-border',
        interactive ? 'press' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon name={icon} size={13} className={danger ? 'text-danger' : 'text-muted'} />
      <span
        className={[
          'flex-1 min-w-0 text-left font-mono text-mono11',
          danger ? 'text-danger' : 'text-text',
        ].join(' ')}
      >
        {label}
        {subtle && <span className="block font-mono text-mono9 text-dim mt-0.5">{subtle}</span>}
      </span>
      {value && (
        <span
          className={['font-mono text-mono10 shrink-0', danger ? 'text-danger' : 'text-muted'].join(
            ' ',
          )}
        >
          {value}
        </span>
      )}
      {interactive && <Icon name="chev-r" size={11} className="text-dim shrink-0" />}
    </Tag>
  );
}

function ChangePinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePin = useLock((s) => s.changePin);
  const [phase, setPhase] = useState<'old' | 'new' | 'confirm' | 'done'>('old');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPhase('old');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
  }

  async function submit(): Promise<void> {
    setError(null);
    if (phase === 'old') {
      setPhase('new');
      return;
    }
    if (phase === 'new') {
      if (newPin.length < 4) {
        setError('PIN mínimo 4 dígitos.');
        return;
      }
      setPhase('confirm');
      return;
    }
    if (phase === 'confirm') {
      if (confirmPin !== newPin) {
        setError('Los PIN no coinciden.');
        setConfirmPin('');
        return;
      }
      try {
        const ok = await changePin(oldPin, newPin);
        if (!ok) {
          setError('PIN actual incorrecto.');
          reset();
          return;
        }
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        reset();
      }
    }
  }

  const value = phase === 'old' ? oldPin : phase === 'new' ? newPin : confirmPin;
  const setValue = phase === 'old' ? setOldPin : phase === 'new' ? setNewPin : setConfirmPin;
  const canSubmit =
    (phase === 'old' && oldPin.length >= 4) ||
    (phase === 'new' && newPin.length >= 4) ||
    (phase === 'confirm' && confirmPin.length >= 4);

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Cambiar PIN"
    >
      {phase === 'done' ? (
        <div className="space-y-3 font-mono text-center">
          <p className="text-mono11 text-accent">PIN actualizado</p>
          <Btn
            variant="solid"
            block
            onClick={() => {
              reset();
              onClose();
            }}
          >
            OK
          </Btn>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-mono10 text-dim text-center">
            {phase === 'old' && 'Introduce tu PIN actual'}
            {phase === 'new' && 'Nuevo PIN (≥4 dígitos)'}
            {phase === 'confirm' && 'Confirma el nuevo PIN'}
          </p>
          <PinPad value={value} onChange={setValue} />
          {error && <p className="font-mono text-mono10 text-danger text-center">{error}</p>}
          <Btn
            variant="solid"
            block
            onClick={() => void submit()}
            disabled={!canSubmit}
            data-testid="change-pin-next"
          >
            {phase === 'confirm' ? 'GUARDAR' : 'SIGUIENTE'}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}
