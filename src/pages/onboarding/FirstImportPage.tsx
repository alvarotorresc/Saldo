import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/Icon';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

interface Option {
  icon: IconName;
  title: string;
  desc: string;
  recommended?: boolean;
  action: 'complete' | 'skip';
}

const OPTIONS: Option[] = [
  {
    icon: 'upload',
    title: 'Import CSV (recomendado)',
    desc: 'Arrastra tu .csv de N26/BBVA/otros',
    recommended: true,
    action: 'complete',
  },
  {
    icon: 'edit',
    title: 'Entrada manual',
    desc: 'Añade transacciones una a una',
    action: 'complete',
  },
  {
    icon: 'download',
    title: 'Restaurar backup',
    desc: 'Desde archivo .saldo',
    action: 'complete',
  },
  {
    icon: 'chev-r',
    title: 'Saltar por ahora',
    desc: 'Empezar vacio',
    action: 'skip',
  },
];

export function FirstImportPage({ onComplete, onSkip }: Props) {
  function handleAction(action: 'complete' | 'skip') {
    if (action === 'skip') {
      onSkip();
    } else {
      onComplete();
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-bg text-text">
      <TopBarV2 title="saldo@local" sub="ONBOARD / DATOS" />

      <div className="flex-1 flex flex-col gap-3 px-4 pt-8 pb-8">
        <h2 className="font-mono text-mono12 text-text tracking-wider mb-2">
          ¿Como quieres empezar?
        </h2>

        {OPTIONS.map((opt) => (
          <button
            key={opt.title}
            type="button"
            onClick={() => handleAction(opt.action)}
            aria-label={opt.title}
            className={[
              'w-full text-left flex items-center gap-3',
              'border rounded-sm px-3 py-3',
              'transition-colors duration-fast',
              opt.recommended ? 'border-accent bg-accentDim' : 'border-border bg-surface',
            ].join(' ')}
          >
            <Icon
              name={opt.icon}
              size={18}
              className={opt.recommended ? 'text-accent' : 'text-muted'}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-mono text-mono12 text-text tracking-wide">{opt.title}</span>
              <span className="font-mono text-mono10 text-muted tracking-wide">{opt.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
