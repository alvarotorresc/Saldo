interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="grid grid-flow-col auto-cols-fr p-1 bg-elevated rounded-xl border border-border">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`press h-9 rounded-lg text-sm font-medium ${
              active ? 'bg-surface text-text' : 'text-muted'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
