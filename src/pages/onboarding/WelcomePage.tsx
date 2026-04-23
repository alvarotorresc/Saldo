import { Btn } from '@/ui/primitives/Btn';

interface Props {
  onContinue: () => void;
  onRestore?: () => void;
}

export function WelcomePage({ onContinue, onRestore }: Props) {
  return (
    <div className="flex flex-col min-h-full bg-bg text-text px-4 pt-12 pb-8 gap-8">
      {/* Header */}
      <p className="font-mono text-mono10 text-accent tracking-wider">▌ SALDO · v0.2.0</p>

      {/* Claim */}
      <div className="flex flex-col gap-1">
        <h1 className="font-mono text-d32 text-text tracking-tight leading-tight">Tus finanzas.</h1>
        <h1 className="font-mono text-d32 text-accent tracking-tight leading-tight">Locales.</h1>
        <h1 className="font-mono text-d32 text-text tracking-tight leading-tight">Para siempre.</h1>
      </div>

      {/* Sub-paragraph */}
      <p className="font-sans text-sans13 text-muted leading-snug">
        Cero servidores. Cero tracking. Cifrado AES-256.
      </p>

      {/* Checklist */}
      <ul className="flex flex-col gap-2" aria-label="Caracteristicas">
        {['Datos solo en tu dispositivo', 'Sin cuenta, sin registro', 'Cifrado end-to-end'].map(
          (item) => (
            <li
              key={item}
              className="font-mono text-mono10 text-accent tracking-wide flex items-start gap-2"
            >
              <span aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ),
        )}
      </ul>

      {/* Spacer pushes button to bottom */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="flex flex-col gap-3">
        <Btn variant="solid" size="lg" block onClick={onContinue}>
          COMENZAR →
        </Btn>

        {onRestore && (
          <button
            type="button"
            onClick={onRestore}
            className="font-mono text-mono10 text-muted tracking-wide text-center"
          >
            ¿Ya tienes backup? Restaurar
          </button>
        )}
      </div>
    </div>
  );
}
