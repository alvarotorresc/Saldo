interface Props {
  items: { label: string; income?: number; expense?: number; color?: string }[];
  height?: number;
  formatY?: (n: number) => string;
  mode?: 'income-expense' | 'single';
}

export function BarChart({ items, height = 180, formatY, mode = 'income-expense' }: Props) {
  if (items.length === 0) {
    return (
      <div
        className="grid place-items-center text-xs text-dim border border-dashed border-border rounded-xl"
        style={{ height }}
      >
        Sin datos
      </div>
    );
  }
  const max = Math.max(
    1,
    ...items.map((i) =>
      Math.max(mode === 'single' ? (i.expense ?? 0) : Math.max(i.income ?? 0, i.expense ?? 0)),
    ),
  );
  const w = 320;
  const h = height;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 28;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;
  const slot = chartW / items.length;
  const gap = 6;
  const barW = mode === 'income-expense' ? (slot - gap * 3) / 2 : slot - gap * 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padLeft}
          x2={w - padRight}
          y1={padTop + chartH * p}
          y2={padTop + chartH * p}
          stroke="#1F1F23"
          strokeDasharray="2 4"
        />
      ))}
      {items.map((it, i) => {
        const x0 = padLeft + slot * i + gap;
        const incomeH = ((it.income ?? 0) / max) * chartH;
        const expenseH = ((it.expense ?? 0) / max) * chartH;
        if (mode === 'single') {
          return (
            <g key={i}>
              <rect
                x={x0}
                y={padTop + chartH - expenseH}
                width={barW}
                height={expenseH}
                fill={it.color ?? '#F87171'}
                rx={3}
              />
              <text x={x0 + barW / 2} y={h - 14} fontSize="9" fill="#5A5A63" textAnchor="middle">
                {it.label}
              </text>
              {formatY && (
                <text
                  x={x0 + barW / 2}
                  y={padTop + chartH - expenseH - 3}
                  fontSize="8"
                  fill="#8A8A93"
                  textAnchor="middle"
                >
                  {formatY(it.expense ?? 0)}
                </text>
              )}
            </g>
          );
        }
        return (
          <g key={i}>
            <rect
              x={x0}
              y={padTop + chartH - incomeH}
              width={barW}
              height={incomeH}
              fill="#10B981"
              rx={3}
              opacity={0.9}
            />
            <rect
              x={x0 + barW + gap}
              y={padTop + chartH - expenseH}
              width={barW}
              height={expenseH}
              fill="#F87171"
              rx={3}
              opacity={0.9}
            />
            <text
              x={x0 + barW + gap / 2}
              y={h - 14}
              fontSize="9"
              fill="#5A5A63"
              textAnchor="middle"
            >
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
