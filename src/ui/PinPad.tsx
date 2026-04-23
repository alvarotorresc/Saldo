// PinPad — numeric input pad for PIN entry.
// Used by PinSetupPage and LockPage.

interface Props {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  dotsAccent?: boolean;
}

// Digit buttons: 1-9 in a 3x3 grid, then a bottom row of [empty, 0, backspace].
const GRID_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ value, onChange, maxLength = 6, dotsAccent = true }: Props) {
  function append(digit: string) {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  }

  function backspace() {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Dots row */}
      <div
        className="flex items-center gap-[10px]"
        role="status"
        aria-label={`PIN: ${value.length} dígitos introducidos`}
      >
        {Array.from({ length: maxLength }, (_, i) => {
          const filled = i < value.length;
          return (
            <div
              key={i}
              data-filled={filled}
              className={[
                'w-[14px] h-[14px] rounded-full border',
                filled
                  ? dotsAccent
                    ? 'bg-accent border-accent'
                    : 'bg-dim border-dim'
                  : 'border-borderStrong bg-transparent',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Digit pad */}
      <div className="w-full max-w-[280px]">
        {/* 3x3 grid */}
        <div className="grid grid-cols-3 gap-2">
          {GRID_DIGITS.map((digit) => (
            <PadButton key={digit} label={digit} onClick={() => append(digit)} />
          ))}
        </div>

        {/* Bottom row: empty | 0 | backspace */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {/* Empty placeholder — disabled */}
          <PadButton label="" disabled />
          <PadButton label="0" onClick={() => append('0')} />
          <PadButton
            label="⌫"
            onClick={backspace}
            aria-label="Borrar"
            disabled={value.length === 0}
          />
        </div>
      </div>
    </div>
  );
}

interface PadButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

function PadButton({ label, onClick, disabled = false, 'aria-label': ariaLabel }: PadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={ariaLabel ?? (label !== '⌫' ? label || undefined : 'Borrar')}
      className={[
        'flex items-center justify-center',
        'aspect-[3/2]',
        'border border-border bg-surface rounded-sm',
        'font-mono text-mono12 text-text',
        'transition-colors duration-fast',
        'disabled:opacity-0',
        !disabled && onClick ? 'active:bg-surface2 active:border-borderStrong' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </button>
  );
}
